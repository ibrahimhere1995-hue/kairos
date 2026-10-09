//! Item business logic: create, edit, soft-delete, restore, complete, reschedule, list.

use chrono::{DateTime, Duration, Local, NaiveDate, Utc};
use rusqlite::{Connection, Transaction};

use crate::error::{AppError, AppResult};
use crate::models::dashboard::{Dashboard, DashboardQuery};
use crate::models::inputs::{DateRange, ItemFilters, ItemInput, ScheduleInput};
use crate::models::item::{Item, ItemSource};
use crate::repo::items as repo;
use crate::scheduler::recurrence as rule;
use crate::services::item_rules::{
    Schedule, normalize_date, normalize_instant, validate_item, validate_schedule,
};
use crate::services::reminders::{self, Clock, DEFAULT_OFFSETS};
use crate::services::series::{self, EditScope};
use crate::util::{new_id, now_utc};

fn schedule_of(item: &Item) -> Schedule {
    Schedule {
        start_at: item.start_at.clone(),
        end_at: item.end_at.clone(),
        due_date: item.due_date.clone(),
    }
}

fn apply_schedule(item: &mut Item, schedule: Schedule) {
    // Moving an item that already had a moment counts as a reschedule (PRD R6: after 3+,
    // offer to break it into smaller steps). Giving an Inbox item its first date does not.
    let previous = schedule_of(item);
    if !previous.is_empty() && previous != schedule {
        item.reschedule_count = item.reschedule_count.saturating_add(1);
    }
    item.all_day = schedule.due_date.is_some();
    item.start_at = schedule.start_at;
    item.end_at = schedule.end_at;
    item.due_date = schedule.due_date;
}

/// Loads an item that is not in the Trash.
fn load_active(tx: &Transaction, id: &str) -> AppResult<Item> {
    match repo::get(tx, id)? {
        Some(item) if item.deleted_at.is_none() => Ok(item),
        _ => Err(AppError::NotFound),
    }
}

/// Runs `change` on an active item and saves the result, inside the caller's transaction.
/// A computed occurrence of a repeating item is stored first, so only that one changes.
/// If the item's date or time changed, its reminders start over from the new moment.
fn modify_in(
    tx: &Transaction,
    id: &str,
    change: impl FnOnce(&Transaction, &mut Item) -> AppResult<()>,
) -> AppResult<Item> {
    let id = series::materialize(tx, id)?;
    let mut item = load_active(tx, &id)?;
    let before = schedule_of(&item);
    change(tx, &mut item)?;
    item.updated_at = now_utc();
    repo::update(tx, &item)?;
    if schedule_of(&item) != before {
        reminders::reschedule_item(tx, &item, &Clock::current(tx)?)?;
    }
    Ok(item)
}

/// `modify_in` for one item, in its own transaction.
fn modify(
    conn: &mut Connection,
    id: &str,
    change: impl FnOnce(&Transaction, &mut Item) -> AppResult<()>,
) -> AppResult<Item> {
    let tx = conn.transaction()?;
    let item = modify_in(&tx, id, change)?;
    tx.commit()?;
    Ok(item)
}

/// Most items `reschedule_many` moves at once ("Move all to today").
pub const MAX_BULK: usize = 500;
/// Most Inbox tasks listed for time-blocking.
pub const UNSCHEDULED_LIMIT: i64 = 200;

pub fn create(conn: &mut Connection, input: &ItemInput) -> AppResult<Item> {
    let tx = conn.transaction()?;
    let valid = validate_item(&tx, input)?;
    let repeat = series::valid_rule(input.rrule.as_deref(), !valid.schedule.is_empty())?;
    let now = now_utc();
    let item = Item {
        id: new_id(),
        kind: valid.kind,
        title: valid.title,
        notes: valid.notes,
        area_id: valid.area_id,
        priority: valid.priority,
        all_day: valid.schedule.due_date.is_some(),
        start_at: valid.schedule.start_at,
        end_at: valid.schedule.end_at,
        due_date: valid.schedule.due_date,
        completed_at: None,
        skipped_at: None,
        location: valid.location,
        rrule: repeat,
        recurrence_parent_id: None,
        original_start_at: None,
        milestone_id: None,
        reschedule_count: 0,
        source: input.source.unwrap_or(ItemSource::Manual),
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
    };
    repo::insert(&tx, &item)?;
    let offsets = input.reminders.as_deref().unwrap_or(&DEFAULT_OFFSETS);
    reminders::set_for_item(&tx, &item, offsets, &Clock::current(&tx)?)?;
    tx.commit()?;
    Ok(shown(&item))
}

/// How an item appears to the frontend: a repeating series as its first occurrence.
fn shown(item: &Item) -> Item {
    match (&item.rrule, rule::series_start(&Local, item)) {
        (Some(_), Some(start)) if item.recurrence_parent_id.is_none() => {
            rule::occurrence_item(&Local, item, start)
        }
        _ => item.clone(),
    }
}

/// Replaces every editable field (the editor always sends the whole item). For a repeating
/// item, only the given occurrence changes; see `update_scoped`.
pub fn update(conn: &mut Connection, id: &str, input: &ItemInput) -> AppResult<Item> {
    update_scoped(conn, id, input, EditScope::This)
}

/// `update`, where for a repeating item `scope` says whether only this occurrence changes or
/// this one and all later ones.
pub fn update_scoped(
    conn: &mut Connection,
    id: &str,
    input: &ItemInput,
    scope: EditScope,
) -> AppResult<Item> {
    if scope == EditScope::Following {
        let tx = conn.transaction()?;
        if let Some((series_item, key)) = series::series_and_key(&tx, id)? {
            let item = update_following(&tx, &series_item, &key, input)?;
            tx.commit()?;
            return Ok(item);
        }
    }
    let item = modify(conn, id, |tx, item| {
        let valid = validate_item(tx, input)?;
        // A stored occurrence never repeats on its own; repeating is set on the series.
        if item.recurrence_parent_id.is_none() {
            item.rrule = series::valid_rule(input.rrule.as_deref(), !valid.schedule.is_empty())?;
        }
        item.kind = valid.kind;
        item.title = valid.title;
        item.notes = valid.notes;
        item.area_id = valid.area_id;
        item.priority = valid.priority;
        item.location = valid.location;
        apply_schedule(item, valid.schedule);
        if let Some(offsets) = &input.reminders {
            reminders::set_for_item(tx, item, offsets, &Clock::current(tx)?)?;
        }
        Ok(())
    })?;
    Ok(shown(&item))
}

/// "This and following" (P2-T06). From the first occurrence it changes the whole series;
/// otherwise the series ends just before `key` and a new one starts there with the new values.
fn update_following(
    tx: &Transaction,
    series_item: &Item,
    key: &str,
    input: &ItemInput,
) -> AppResult<Item> {
    let valid = validate_item(tx, input)?;
    let repeat = series::valid_rule(input.rrule.as_deref(), !valid.schedule.is_empty())?;
    let at = rule::parse_key(key).ok_or(AppError::NotFound)?;
    let occurrence = rule::occurrence_item(&Local, series_item, at);
    let timing_changed = schedule_of(&occurrence) != valid.schedule || repeat != series_item.rrule;
    let clock = Clock::current(tx)?;
    let now = now_utc();

    if series::is_first(series_item, key) {
        let mut whole = series_item.clone();
        whole.kind = valid.kind;
        whole.title = valid.title;
        whole.notes = valid.notes;
        whole.area_id = valid.area_id;
        whole.priority = valid.priority;
        whole.location = valid.location;
        whole.all_day = valid.schedule.due_date.is_some();
        whole.start_at = valid.schedule.start_at;
        whole.end_at = valid.schedule.end_at;
        whole.due_date = valid.schedule.due_date;
        whole.rrule = repeat;
        whole.updated_at = now.clone();
        repo::update(tx, &whole)?;
        if timing_changed {
            series::move_or_drop_exceptions(tx, series_item, None, None, true, &now)?;
            reminders::reschedule_item(tx, &whole, &clock)?;
        }
        if let Some(offsets) = &input.reminders {
            reminders::set_for_item(tx, &whole, offsets, &clock)?;
        }
        return Ok(shown(&whole));
    }

    let continuation = Item {
        id: new_id(),
        kind: valid.kind,
        title: valid.title,
        notes: valid.notes,
        area_id: valid.area_id,
        priority: valid.priority,
        all_day: valid.schedule.due_date.is_some(),
        start_at: valid.schedule.start_at,
        end_at: valid.schedule.end_at,
        due_date: valid.schedule.due_date,
        completed_at: None,
        skipped_at: None,
        location: valid.location,
        rrule: repeat,
        recurrence_parent_id: None,
        original_start_at: None,
        milestone_id: None,
        reschedule_count: 0,
        source: series_item.source,
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
    };
    repo::insert(tx, &continuation)?;
    let offsets = match &input.reminders {
        Some(offsets) => offsets.clone(),
        None => reminders::offsets_for_item(tx, &series_item.id)?,
    };
    reminders::set_for_item(tx, &continuation, &offsets, &clock)?;
    series::copy_steps(tx, &series_item.id, &continuation.id)?;
    let keeps_series = continuation
        .rrule
        .is_some()
        .then_some(continuation.id.as_str());
    series::end_before(tx, series_item, key, keeps_series, timing_changed)?;
    Ok(shown(&continuation))
}

pub fn reschedule(conn: &mut Connection, id: &str, input: &ScheduleInput) -> AppResult<Item> {
    modify(conn, id, |_, item| {
        let schedule = validate_schedule(item.kind, input)?;
        apply_schedule(item, schedule);
        Ok(())
    })
}

/// Gives several items the same new moment, all or nothing ("Move all to today", PRD R6).
pub fn reschedule_many(
    conn: &mut Connection,
    ids: &[String],
    input: &ScheduleInput,
) -> AppResult<Vec<Item>> {
    if ids.len() > MAX_BULK {
        return Err(AppError::invalid("ids", "tooMany"));
    }
    let tx = conn.transaction()?;
    let mut moved = Vec::with_capacity(ids.len());
    for id in ids {
        moved.push(modify_in(&tx, id, |_, item| {
            let schedule = validate_schedule(item.kind, input)?;
            apply_schedule(item, schedule);
            Ok(())
        })?);
    }
    tx.commit()?;
    Ok(moved)
}

/// "Let it go" (PRD R6): the task is set aside as skipped, not deleted. Undo with `unskip`.
pub fn skip(conn: &mut Connection, id: &str) -> AppResult<Item> {
    modify(conn, id, |_, item| {
        if item.skipped_at.is_none() {
            item.skipped_at = Some(now_utc());
        }
        item.completed_at = None;
        Ok(())
    })
}

pub fn unskip(conn: &mut Connection, id: &str) -> AppResult<Item> {
    modify(conn, id, |_, item| {
        item.skipped_at = None;
        Ok(())
    })
}

/// Inbox tasks for the calendar's "To schedule" list (time-blocking, PRD R12).
pub fn unscheduled(conn: &Connection) -> AppResult<Vec<Item>> {
    Ok(repo::list_unscheduled(conn, UNSCHEDULED_LIMIT)?)
}

/// Completing twice keeps the original completion time.
pub fn complete(conn: &mut Connection, id: &str) -> AppResult<Item> {
    modify(conn, id, |_, item| {
        if item.completed_at.is_none() {
            item.completed_at = Some(now_utc());
        }
        item.skipped_at = None;
        Ok(())
    })
}

pub fn uncomplete(conn: &mut Connection, id: &str) -> AppResult<Item> {
    modify(conn, id, |_, item| {
        item.completed_at = None;
        Ok(())
    })
}

/// Soft delete: the item moves to the Trash (restorable for 30 days, P1-T13).
/// For a repeating item only the given occurrence; see `delete_scoped`.
pub fn delete(conn: &mut Connection, id: &str) -> AppResult<()> {
    delete_scoped(conn, id, EditScope::This)
}

/// `delete`, where for a repeating item `scope` removes only this occurrence, or this one and
/// every later one.
pub fn delete_scoped(conn: &mut Connection, id: &str, scope: EditScope) -> AppResult<()> {
    let tx = conn.transaction()?;
    let target = match (scope, series::series_and_key(&tx, id)?) {
        (EditScope::Following, Some((series_item, key))) => {
            if series::is_first(&series_item, &key) {
                series::delete_all(&tx, &series_item)?;
            } else {
                series::end_before(&tx, &series_item, &key, None, true)?;
            }
            None
        }
        _ => Some(series::materialize(&tx, id)?),
    };
    if let Some(target) = target {
        let item = load_active(&tx, &target)?;
        if item.rrule.is_some() && item.recurrence_parent_id.is_none() {
            series::delete_all(&tx, &item)?;
        } else {
            modify_in(&tx, &target, |_, item| {
                item.deleted_at = Some(now_utc());
                Ok(())
            })?;
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn restore(conn: &mut Connection, id: &str) -> AppResult<Item> {
    let tx = conn.transaction()?;
    // Undo after deleting a computed occurrence: restore the stored one behind it.
    let id = series::stored_occurrence(&tx, id)?.unwrap_or_else(|| id.to_owned());
    let mut item = repo::get(&tx, &id)?.ok_or(AppError::NotFound)?;
    if let Some(deleted_at) = item.deleted_at.clone() {
        item.deleted_at = None;
        item.updated_at = now_utc();
        repo::update(&tx, &item)?;
        if item.rrule.is_some() && item.recurrence_parent_id.is_none() {
            series::restore_with_series(&tx, &item.id, &deleted_at)?;
        }
    }
    tx.commit()?;
    Ok(shown(&item))
}

pub fn list(conn: &Connection, range: &DateRange, filters: &ItemFilters) -> AppResult<Vec<Item>> {
    let start = normalize_instant("start", &range.start)?;
    let end = normalize_instant("end", &range.end)?;
    let start_date = normalize_date("startDate", &range.start_date)?;
    let end_date = normalize_date("endDate", &range.end_date)?;
    if end <= start || end_date <= start_date {
        return Err(AppError::invalid("end", "beforeStart"));
    }

    let mut items = repo::list_in_range(conn, &start, &end, &start_date, &end_date)?;
    items.extend(series::in_range(
        conn,
        &Local,
        instant(&start)?,
        instant(&end)?,
        date(&start_date)?,
        date(&end_date)?,
    )?);
    if !filters.area_ids.is_empty() {
        items.retain(|item| {
            item.area_id
                .as_ref()
                .is_some_and(|area| filters.area_ids.contains(area))
        });
    }
    Ok(items)
}

pub fn dashboard(conn: &Connection, query: &DashboardQuery) -> AppResult<Dashboard> {
    let day_start = normalize_instant("dayStart", &query.day_start)?;
    let day_end = normalize_instant("dayEnd", &query.day_end)?;
    let today = normalize_date("today", &query.today)?;
    let week_end = normalize_instant("weekEnd", &query.week_end)?;
    let week_end_date = normalize_date("weekEndDate", &query.week_end_date)?;
    normalize_instant("now", &query.now)?;

    let tz = Local;
    let (start, end) = (instant(&day_start)?, instant(&day_end)?);
    let today_date = date(&today)?;
    let tomorrow = today_date.succ_opt().unwrap_or(today_date);

    let mut today_items = repo::open_today(conn, &day_start, &day_end, &today)?;
    today_items.extend(series::in_range(
        conn, &tz, start, end, today_date, tomorrow,
    )?);
    let mut overdue = repo::overdue_tasks(conn, &day_start, &today)?;
    overdue.extend(series::latest_missed(conn, &tz, start)?);
    let mut this_week = repo::open_rest_of_week(conn, &day_end, &today, &week_end, &week_end_date)?;
    // Only the next occurrence of each series, so a daily habit doesn't fill the week.
    let week_last = instant(&week_end)? - Duration::seconds(1);
    this_week.extend(series::next_between(conn, &tz, end, week_last)?);

    Ok(Dashboard {
        today: today_items,
        overdue,
        this_week,
        done_today: repo::completed_between(conn, &day_start, &day_end)?,
    })
}

fn instant(value: &str) -> AppResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .map(|t| t.with_timezone(&Utc))
        .map_err(|_| AppError::invalid("date", "invalidDateTime"))
}

fn date(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| AppError::invalid("date", "invalidDate"))
}

#[cfg(test)]
#[path = "items_tests.rs"]
mod tests;
