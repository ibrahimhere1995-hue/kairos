//! Reminders (PRD R3): which reminders an item has, when each fires next, firing and snoozing.
//! The time maths lives in `scheduler::timing`; this module keeps the `reminders` table in step
//! with items.

use chrono::{DateTime, Local, NaiveTime, SecondsFormat, TimeZone, Utc};
use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::item::Item;
use crate::models::reminder::{DueReminder, Reminder};
use crate::repo::{items, reminders as repo};
use crate::scheduler::timing::{self, Snooze};
use crate::services::{app_settings, series};
use crate::util::{new_id, now_utc};

/// PRD R3 default: at the start time for timed items, at the default time on the day otherwise.
pub const DEFAULT_OFFSETS: [i64; 1] = [0];
pub const MAX_REMINDERS: usize = 10;
/// Four weeks before is the earliest reminder the editor offers (and the limit we accept).
pub const MAX_OFFSET_MINUTES: i64 = 4 * 7 * 24 * 60;

/// The time context reminder times are computed in.
#[derive(Debug, Clone)]
pub struct Clock<Tz: TimeZone> {
    pub tz: Tz,
    /// The default reminder time for date-only items (settings › Reminders).
    pub day_time: NaiveTime,
    pub now: DateTime<Utc>,
}

impl Clock<Local> {
    /// The device's time zone, the saved default reminder time, and the current time.
    pub fn current(conn: &Connection) -> AppResult<Self> {
        let saved = app_settings::get(conn)?.default_reminder_time;
        Ok(Self {
            tz: Local,
            day_time: timing::parse_day_time(&saved).unwrap_or(default_day_time()),
            now: Utc::now(),
        })
    }
}

fn default_day_time() -> NaiveTime {
    NaiveTime::from_hms_opt(9, 0, 0).unwrap_or(NaiveTime::MIN)
}

pub fn iso(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// Sorted, without duplicates, within limits.
pub fn normalize_offsets(offsets: &[i64]) -> AppResult<Vec<i64>> {
    if offsets
        .iter()
        .any(|m| !(0..=MAX_OFFSET_MINUTES).contains(m))
    {
        return Err(AppError::invalid("reminders", "outOfRange"));
    }
    let mut sorted = offsets.to_vec();
    sorted.sort_unstable();
    sorted.dedup();
    if sorted.len() > MAX_REMINDERS {
        return Err(AppError::invalid("reminders", "tooMany"));
    }
    Ok(sorted)
}

fn is_series(item: &Item) -> bool {
    item.rrule.is_some() && item.recurrence_parent_id.is_none()
}

/// Fresh timing for a reminder: its next fire time, already "fired" if that moment has passed
/// (moving a task to earlier today must not set off a reminder for a time already gone).
/// A repeating series reminds about its next occurrence that is still ahead.
fn fresh_timing<Tz: TimeZone>(
    conn: &Connection,
    item: &Item,
    offset: i64,
    clock: &Clock<Tz>,
) -> AppResult<(Option<String>, Option<String>)> {
    if is_series(item) {
        let next =
            series::next_reminder_anchor(conn, &clock.tz, item, offset, clock.day_time, clock.now)?;
        return Ok(match next {
            Some((anchor, _)) => (
                Some(iso(timing::fire_time(&clock.tz, anchor, offset))),
                None,
            ),
            None => (None, Some(iso(clock.now))),
        });
    }
    let anchor = timing::anchor(
        &clock.tz,
        item.start_at.as_deref(),
        item.due_date.as_deref(),
        clock.day_time,
    );
    Ok(match anchor {
        None => (None, None),
        Some(anchor) => {
            let fire = timing::fire_time(&clock.tz, anchor, offset);
            let fired = (fire <= clock.now).then(|| iso(clock.now));
            (Some(iso(fire)), fired)
        }
    })
}

/// Replaces an item's reminders with `offsets`. Kept offsets keep their state; removed ones
/// are soft-deleted. Call inside the item's transaction.
pub fn set_for_item<Tz: TimeZone>(
    conn: &Connection,
    item: &Item,
    offsets: &[i64],
    clock: &Clock<Tz>,
) -> AppResult<()> {
    let wanted = normalize_offsets(offsets)?;
    let now = now_utc();
    let existing = repo::list_for_item(conn, &item.id)?;
    for reminder in &existing {
        if !wanted.contains(&reminder.offset_minutes) {
            repo::soft_delete(conn, &reminder.id, &now)?;
        }
    }
    for &offset in &wanted {
        if existing.iter().any(|r| r.offset_minutes == offset) {
            continue;
        }
        let (fire_at, fired_at) = fresh_timing(conn, item, offset, clock)?;
        let reminder = Reminder {
            id: new_id(),
            item_id: item.id.clone(),
            offset_minutes: offset,
            fire_at,
            fired_at,
            snoozed_until: None,
        };
        repo::insert(conn, &reminder, &now)?;
    }
    Ok(())
}

/// After an item's date or time changed: every reminder starts over from the new moment
/// (snoozes are cleared).
pub fn reschedule_item<Tz: TimeZone>(
    conn: &Connection,
    item: &Item,
    clock: &Clock<Tz>,
) -> AppResult<()> {
    let now = now_utc();
    for mut reminder in repo::list_for_item(conn, &item.id)? {
        let (fire_at, fired_at) = fresh_timing(conn, item, reminder.offset_minutes, clock)?;
        reminder.fire_at = fire_at;
        reminder.fired_at = fired_at;
        reminder.snoozed_until = None;
        repo::update_timing(conn, &reminder, &now)?;
    }
    Ok(())
}

/// Recomputes reminders that haven't fired yet, after the time zone or the default reminder
/// time changed. Returns how many changed.
pub fn recompute_waiting<Tz: TimeZone>(
    conn: &mut Connection,
    clock: &Clock<Tz>,
) -> AppResult<usize> {
    let tx = conn.transaction()?;
    let now = now_utc();
    let mut changed = 0;
    for mut reminder in repo::list_waiting(&tx)? {
        let Some(item) = items::get(&tx, &reminder.item_id)? else {
            continue;
        };
        let (fire_at, fired_at) = fresh_timing(&tx, &item, reminder.offset_minutes, clock)?;
        if fire_at != reminder.fire_at {
            reminder.fire_at = fire_at;
            reminder.fired_at = fired_at;
            repo::update_timing(&tx, &reminder, &now)?;
            changed += 1;
        }
    }
    tx.commit()?;
    Ok(changed)
}

/// An item's reminder offsets, for the editor.
pub fn offsets_for_item(conn: &Connection, item_id: &str) -> AppResult<Vec<i64>> {
    Ok(repo::list_for_item(conn, item_id)?
        .into_iter()
        .map(|r| r.offset_minutes)
        .collect())
}

/// Takes every reminder due by `now` and marks it fired, in one transaction, so each fires once.
/// A repeating series' reminder moves on to its next occurrence instead, and is announced for
/// the occurrence it was due for (unless that one was meanwhile done, moved or deleted).
pub fn take_due(conn: &mut Connection, now: DateTime<Utc>) -> AppResult<Vec<DueReminder>> {
    let tx = conn.transaction()?;
    let clock = Clock {
        now,
        ..Clock::current(&tx)?
    };
    let stamp = iso(now);
    let mut announced = Vec::new();
    for mut entry in repo::due(&tx, &stamp)? {
        let Some(mut reminder) = repo::get(&tx, &entry.reminder_id)? else {
            continue;
        };
        let series_item = items::get(&tx, &entry.item_id)?.filter(is_series);
        reminder.snoozed_until = None;
        match series_item {
            None => {
                reminder.fired_at = Some(stamp.clone());
                announced.push(entry);
            }
            Some(series_item) => {
                let offset = reminder.offset_minutes;
                let fired_at = DateTime::parse_from_rfc3339(&entry.fire_at)
                    .map(|t| t.with_timezone(&Utc))
                    .unwrap_or(now);
                let due_for = series::next_reminder_anchor(
                    &tx,
                    &clock.tz,
                    &series_item,
                    offset,
                    clock.day_time,
                    fired_at - chrono::Duration::seconds(1),
                )?;
                if let Some((anchor, occurrence)) = due_for
                    && timing::fire_time(&clock.tz, anchor, offset) <= now
                {
                    entry.item_id = occurrence.id;
                    entry.start_at = occurrence.start_at;
                    entry.due_date = occurrence.due_date;
                    announced.push(entry);
                }
                let (fire_at, fired) = fresh_timing(&tx, &series_item, offset, &clock)?;
                reminder.fire_at = fire_at;
                reminder.fired_at = fired;
            }
        }
        repo::update_timing(&tx, &reminder, &stamp)?;
    }
    tx.commit()?;
    Ok(announced)
}

/// "Snooze" on a notification: the reminder fires again later.
pub fn snooze<Tz: TimeZone>(
    conn: &mut Connection,
    reminder_id: &str,
    choice: Snooze,
    clock: &Clock<Tz>,
) -> AppResult<DateTime<Utc>> {
    let tx = conn.transaction()?;
    let mut reminder = repo::get(&tx, reminder_id)?.ok_or(AppError::NotFound)?;
    let until = timing::snooze_until(&clock.tz, clock.now, choice, clock.day_time);
    reminder.fire_at = Some(iso(until));
    reminder.snoozed_until = Some(iso(until));
    reminder.fired_at = None;
    repo::update_timing(&tx, &reminder, &now_utc())?;
    tx.commit()?;
    Ok(until)
}

/// When the scheduler should next look (the earliest pending reminder), if any.
pub fn next_fire_at(conn: &Connection) -> AppResult<Option<DateTime<Utc>>> {
    Ok(repo::next_fire_at(conn)?
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|t| t.with_timezone(&Utc)))
}

#[cfg(test)]
#[path = "reminders_tests.rs"]
mod tests;
