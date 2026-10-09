//! Repeating items in the database (P2-T06). Rule maths: `scheduler::recurrence`.
//!
//! - A series row (`rrule` set, no parent) is never shown itself; its occurrences are.
//! - Acting on a computed occurrence (done, move, edit "only this one", delete "only this one")
//!   first stores it as an exception item (`materialize`), then acts on that.
//! - "This and following" ends the series just before the occurrence and starts a new one.

use std::collections::HashMap;

use chrono::{DateTime, Duration, Local, NaiveDateTime, TimeZone, Utc};
use rusqlite::Connection;
use serde::Deserialize;

use crate::error::{AppError, AppResult};
use crate::models::item::{Item, ItemKind};
use crate::repo::{checklist, items as repo};
use crate::scheduler::recurrence::{self as rule, RuleError};
use crate::services::reminders::{self, Clock};
use crate::util::{new_id, now_utc};

/// How far back to look for a repeating task's latest missed occurrence.
const MISSED_LOOKBACK_DAYS: i64 = 400;

/// Which occurrences an edit or delete of a repeating item applies to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum EditScope {
    /// Only the occurrence that was opened.
    #[default]
    This,
    /// That occurrence and every later one.
    Following,
}

/// Validates the editor's repeat rule for an item with `has_date`.
pub fn valid_rule(rule: Option<&str>, has_date: bool) -> AppResult<Option<String>> {
    let Some(rule) = rule.filter(|r| !r.trim().is_empty()) else {
        return Ok(None);
    };
    if !has_date {
        return Err(AppError::invalid("rrule", "repeatNeedsDate"));
    }
    match rule::normalize_rule(rule) {
        Ok(rule) => Ok(Some(rule)),
        Err(RuleError::Invalid | RuleError::Unsupported) => {
            Err(AppError::invalid("rrule", "invalidRepeat"))
        }
    }
}

struct Series {
    item: Item,
    rule: String,
    start: NaiveDateTime,
    /// Stored occurrences by key (deleted ones too: a deleted occurrence stays hidden).
    exceptions: HashMap<String, Item>,
}

impl Series {
    fn load<Tz: TimeZone>(conn: &Connection, tz: &Tz, item: Item) -> AppResult<Option<Self>> {
        let (Some(rule), Some(start)) = (item.rrule.clone(), rule::series_start(tz, &item)) else {
            return Ok(None);
        };
        let exceptions = repo::list_exceptions(conn, &item.id)?
            .into_iter()
            .filter_map(|e| e.original_start_at.clone().map(|k| (k, e)))
            .collect();
        Ok(Some(Self {
            item,
            rule,
            start,
            exceptions,
        }))
    }

    fn all<Tz: TimeZone>(conn: &Connection, tz: &Tz) -> AppResult<Vec<Self>> {
        let mut all = Vec::new();
        for item in repo::list_series(conn)? {
            all.extend(Self::load(conn, tz, item)?);
        }
        Ok(all)
    }

    fn length(&self) -> Duration {
        let parse = |s: Option<&str>| s.and_then(|s| DateTime::parse_from_rfc3339(s).ok());
        match (
            parse(self.item.start_at.as_deref()),
            parse(self.item.end_at.as_deref()),
        ) {
            (Some(s), Some(e)) => e - s,
            _ => Duration::zero(),
        }
    }

    /// Computed occurrences between two local times (inclusive), minus stored ones.
    fn occurrences<Tz: TimeZone>(
        &self,
        tz: &Tz,
        from: NaiveDateTime,
        to: NaiveDateTime,
    ) -> Vec<Item> {
        rule::occurrences(&self.rule, self.start, from, to)
            .unwrap_or_default()
            .into_iter()
            .filter(|local| {
                !self
                    .exceptions
                    .contains_key(&rule::occurrence_key(&self.item, *local))
            })
            .map(|local| rule::occurrence_item(tz, &self.item, local))
            .collect()
    }
}

fn local<Tz: TimeZone>(tz: &Tz, t: DateTime<Utc>) -> NaiveDateTime {
    t.with_timezone(tz).naive_local()
}

fn parse_utc(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|t| t.with_timezone(&Utc))
}

/// Occurrences overlapping a calendar range: timed ones overlapping `[start, end)`,
/// date-only ones on days in `[start_date, end_date)`.
pub fn in_range<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    start: DateTime<Utc>,
    end: DateTime<Utc>,
    start_date: chrono::NaiveDate,
    end_date: chrono::NaiveDate,
) -> AppResult<Vec<Item>> {
    let mut found = Vec::new();
    for series in Series::all(conn, tz)? {
        if rule::is_date_only(&series.item) {
            let from = start_date.and_time(chrono::NaiveTime::MIN);
            let to = end_date.and_time(chrono::NaiveTime::MIN) - Duration::seconds(1);
            found.extend(series.occurrences(tz, from, to));
        } else {
            // Start early enough to catch an occurrence that began before and is still going.
            let from = local(tz, start) - series.length();
            let to = local(tz, end) - Duration::seconds(1);
            found.extend(series.occurrences(tz, from, to).into_iter().filter(|o| {
                let o_start = o.start_at.as_deref().and_then(parse_utc);
                let o_end = o.end_at.as_deref().and_then(parse_utc).or(o_start);
                matches!((o_start, o_end), (Some(s), Some(e)) if s < end && (e > start || s >= start))
            }));
        }
    }
    Ok(found)
}

/// PRD R6 for repeating tasks: only the most recent occurrence before today can have
/// slipped (and only one from after the series was created); older ones are simply past.
pub fn latest_missed<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    day_start: DateTime<Utc>,
) -> AppResult<Vec<Item>> {
    let today = local(tz, day_start);
    let mut missed = Vec::new();
    for series in Series::all(conn, tz)? {
        if series.item.kind != ItemKind::Task {
            continue;
        }
        let window = Duration::days(MISSED_LOOKBACK_DAYS);
        let latest = rule::latest_before(
            &series.rule,
            series.start,
            today - Duration::seconds(1),
            window,
        )
        .unwrap_or(None);
        let created = parse_utc(&series.item.created_at).map(|c| local(tz, c).date());
        if let Some(latest) = latest
            && created.is_none_or(|c| latest.date() >= c)
            && !series
                .exceptions
                .contains_key(&rule::occurrence_key(&series.item, latest))
        {
            missed.push(rule::occurrence_item(tz, &series.item, latest));
        }
    }
    Ok(missed)
}

/// The first occurrence of each series between two moments (inclusive), e.g. "This week".
pub fn next_between<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> AppResult<Vec<Item>> {
    let mut next = Vec::new();
    for series in Series::all(conn, tz)? {
        if let Some(first) = series
            .occurrences(tz, local(tz, from), local(tz, to))
            .into_iter()
            .next()
        {
            next.push(first);
        }
    }
    Ok(next)
}

/// The next occurrence moment (UTC) of a series whose reminder `offset` fires after `now`,
/// skipping stored (done, moved, deleted) occurrences. Used by reminders.
pub fn next_reminder_anchor<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    series: &Item,
    offset_minutes: i64,
    day_time: chrono::NaiveTime,
    now: DateTime<Utc>,
) -> AppResult<Option<(DateTime<Utc>, Item)>> {
    let Some(series) = Series::load(conn, tz, series.clone())? else {
        return Ok(None);
    };
    // Look far enough ahead for yearly series and long offsets.
    // From a month back (whole-day offsets), or the series' start if that's later.
    let from = (local(tz, now) - Duration::days(29)).max(series.start);
    let to = from + Duration::days(800);
    for occurrence in series.occurrences(tz, from, to) {
        let Some(anchor) = crate::scheduler::timing::anchor(
            tz,
            occurrence.start_at.as_deref(),
            occurrence.due_date.as_deref(),
            day_time,
        ) else {
            continue;
        };
        if crate::scheduler::timing::fire_time(tz, anchor, offset_minutes) > now {
            return Ok(Some((anchor, occurrence)));
        }
    }
    Ok(None)
}

/// Resolves an id for a write: a computed occurrence (`series@key`) is stored first as an
/// exception item (copying the series' reminders) and that item's id is returned.
/// Plain ids are returned unchanged.
pub fn materialize(conn: &Connection, id: &str) -> AppResult<String> {
    let Some((series_id, key)) = rule::split_occurrence_id(id) else {
        return Ok(id.to_owned());
    };
    let tz = Local;
    let series_item = repo::get(conn, series_id)?
        .filter(|s| s.deleted_at.is_none() && s.rrule.is_some())
        .ok_or(AppError::NotFound)?;
    let series = Series::load(conn, &tz, series_item)?.ok_or(AppError::NotFound)?;
    if let Some(existing) = series.exceptions.get(key) {
        return Ok(existing.id.clone());
    }
    let at = rule::parse_key(key).ok_or(AppError::NotFound)?;
    let is_occurrence = rule::occurrences(&series.rule, series.start, at, at)
        .is_ok_and(|found| found.contains(&at));
    if !is_occurrence {
        return Err(AppError::NotFound);
    }

    let now = now_utc();
    let mut stored = rule::occurrence_item(&tz, &series.item, at);
    stored.id = new_id();
    stored.rrule = None;
    stored.created_at = now.clone();
    stored.updated_at = now;
    repo::insert(conn, &stored)?;
    let offsets = reminders::offsets_for_item(conn, &series.item.id)?;
    reminders::set_for_item(conn, &stored, &offsets, &Clock::current(conn)?)?;
    Ok(stored.id)
}

/// The stored occurrence behind a computed occurrence id (`series@key`), if there is one.
pub fn stored_occurrence(conn: &Connection, id: &str) -> AppResult<Option<String>> {
    let Some((series_id, key)) = rule::split_occurrence_id(id) else {
        return Ok(None);
    };
    Ok(repo::list_exceptions(conn, series_id)?
        .into_iter()
        .find(|e| e.original_start_at.as_deref() == Some(key))
        .map(|e| e.id))
}

/// The series and occurrence key behind `id` (a computed occurrence, a stored occurrence,
/// or the series itself = its first occurrence), or None for a non-repeating item.
pub fn series_and_key(conn: &Connection, id: &str) -> AppResult<Option<(Item, String)>> {
    let tz = Local;
    let (series_id, key) = match rule::split_occurrence_id(id) {
        Some((series_id, key)) => (series_id.to_owned(), Some(key.to_owned())),
        None => {
            let item = repo::get(conn, id)?.ok_or(AppError::NotFound)?;
            match (
                &item.recurrence_parent_id,
                &item.original_start_at,
                &item.rrule,
            ) {
                (Some(parent), Some(key), _) => (parent.clone(), Some(key.clone())),
                (None, _, Some(_)) => (item.id.clone(), None),
                _ => return Ok(None),
            }
        }
    };
    let series = repo::get(conn, &series_id)?
        .filter(|s| s.deleted_at.is_none() && s.rrule.is_some())
        .ok_or(AppError::NotFound)?;
    let key = match key {
        Some(key) => key,
        None => rule::series_start(&tz, &series)
            .map(|start| rule::occurrence_key(&series, start))
            .ok_or(AppError::NotFound)?,
    };
    Ok(Some((series, key)))
}

/// Is `key` the series' first occurrence (so "this and following" means the whole series)?
pub fn is_first(series: &Item, key: &str) -> bool {
    rule::series_start(&Local, series)
        .is_some_and(|start| rule::occurrence_key(series, start) == key)
}

/// "This and following": the series stops just before `key`. Stored occurrences from `key` on
/// are moved to `continuation` (same timing) or, when the timing changed, unfinished ones are
/// soft-deleted (the new pattern replaces them) and finished ones kept as history.
pub fn end_before(
    conn: &Connection,
    series: &Item,
    key: &str,
    continuation: Option<&str>,
    timing_changed: bool,
) -> AppResult<()> {
    let at = rule::parse_key(key).ok_or(AppError::NotFound)?;
    let rule_text = series.rrule.as_deref().ok_or(AppError::NotFound)?;
    let now = now_utc();
    let mut ended = series.clone();
    ended.rrule = Some(rule::ending_before(rule_text, at));
    ended.updated_at = now.clone();
    repo::update(conn, &ended)?;
    move_or_drop_exceptions(conn, series, Some(key), continuation, timing_changed, &now)
}

/// See `end_before`; `from_key` None means every stored occurrence.
pub fn move_or_drop_exceptions(
    conn: &Connection,
    series: &Item,
    from_key: Option<&str>,
    continuation: Option<&str>,
    timing_changed: bool,
    now: &str,
) -> AppResult<()> {
    for mut exception in repo::list_exceptions(conn, &series.id)? {
        let key = exception.original_start_at.clone().unwrap_or_default();
        if from_key.is_some_and(|from| key.as_str() < from) || exception.deleted_at.is_some() {
            continue;
        }
        let finished = exception.completed_at.is_some() || exception.skipped_at.is_some();
        if timing_changed && !finished {
            exception.deleted_at = Some(now.to_owned());
        } else if let Some(new_series) = continuation {
            exception.recurrence_parent_id = Some(new_series.to_owned());
        } else {
            continue;
        }
        exception.updated_at = now.to_owned();
        repo::update(conn, &exception)?;
    }
    Ok(())
}

/// Soft-deletes a whole series with all its stored occurrences (same timestamp, so restoring
/// the series brings them back together).
pub fn delete_all(conn: &Connection, series: &Item) -> AppResult<()> {
    let now = now_utc();
    let mut gone = series.clone();
    gone.deleted_at = Some(now.clone());
    gone.updated_at = now.clone();
    repo::update(conn, &gone)?;
    for mut exception in repo::list_exceptions(conn, &series.id)? {
        if exception.deleted_at.is_none() {
            exception.deleted_at = Some(now.clone());
            exception.updated_at = now.clone();
            repo::update(conn, &exception)?;
        }
    }
    Ok(())
}

/// Restoring a series from the Trash also restores the occurrences deleted with it.
pub fn restore_with_series(conn: &Connection, series_id: &str, deleted_at: &str) -> AppResult<()> {
    let now = now_utc();
    for mut exception in repo::list_exceptions(conn, series_id)? {
        if exception.deleted_at.as_deref() == Some(deleted_at) {
            exception.deleted_at = None;
            exception.updated_at = now.clone();
            repo::update(conn, &exception)?;
        }
    }
    Ok(())
}

/// Copies a series' steps to a new item ("this and following" keeps the steps).
pub fn copy_steps(conn: &Connection, from: &str, to: &str) -> AppResult<()> {
    let now = now_utc();
    for mut step in checklist::list_for_item(conn, from)? {
        step.id = new_id();
        step.item_id = to.to_owned();
        checklist::insert(conn, &step, &now)?;
    }
    Ok(())
}

#[cfg(test)]
#[path = "series_tests.rs"]
mod tests;
