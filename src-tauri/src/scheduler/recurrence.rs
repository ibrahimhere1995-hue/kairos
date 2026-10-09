//! Repeating items (PRD R1 recurrence, P2-T06): pure rule maths, no database.
//!
//! A series is one stored item with an RFC 5545 `RRULE` (without DTSTART: the item's own
//! date or start time is the first occurrence). Occurrences are computed, not stored.
//! Expansion runs in local wall-clock time ("every Monday at 9:00" stays 9:00 across DST)
//! and is converted to UTC per occurrence.
//!
//! Each occurrence has a stable key: `YYYY-MM-DD` for date-only series, `YYYY-MM-DDTHH:MM`
//! (local) for timed ones. An occurrence that was done, moved or deleted is stored as an
//! "exception" item: `recurrence_parent_id` = the series, `original_start_at` = the key.

use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
use rrule::{Frequency, RRule, Tz as RTz, Unvalidated};

use crate::models::item::Item;
use crate::scheduler::timing::local_to_utc;

/// Separates the series id from the occurrence key in a computed occurrence's id.
pub const OCCURRENCE_SEPARATOR: char = '@';
/// Most occurrences produced for one series in one request (a daily series over a
/// six-week month view is 42).
pub const MAX_OCCURRENCES: u16 = 1000;

const DATE_KEY: &str = "%Y-%m-%d";
const TIME_KEY: &str = "%Y-%m-%dT%H:%M";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuleError {
    /// Not a valid RRULE.
    Invalid,
    /// Valid, but not something Kairos offers (e.g. hourly).
    Unsupported,
}

/// Checks a rule from the editor or Quick Capture and returns it in canonical form
/// (upper-case, no `RRULE:` prefix). Kairos repeats daily, weekly, monthly or yearly.
pub fn normalize_rule(rule: &str) -> Result<String, RuleError> {
    let text = rule
        .trim()
        .trim_start_matches("RRULE:")
        .to_ascii_uppercase();
    if text.is_empty() || text.contains('\n') || text.contains("DTSTART") {
        return Err(RuleError::Invalid);
    }
    let parsed: RRule<Unvalidated> = text.parse().map_err(|_| RuleError::Invalid)?;
    let supported = matches!(
        parsed.get_freq(),
        Frequency::Daily | Frequency::Weekly | Frequency::Monthly | Frequency::Yearly
    ) && parsed.get_by_hour().is_empty()
        && parsed.get_by_minute().is_empty()
        && parsed.get_by_second().is_empty();
    if !supported {
        return Err(RuleError::Unsupported);
    }
    Ok(text)
}

/// The series' first occurrence in local wall-clock time.
pub fn series_start<Tz: TimeZone>(tz: &Tz, item: &Item) -> Option<NaiveDateTime> {
    if let Some(start) = &item.start_at {
        return DateTime::parse_from_rfc3339(start)
            .ok()
            .map(|t| t.with_timezone(tz).naive_local());
    }
    let date = NaiveDate::parse_from_str(item.due_date.as_deref()?, DATE_KEY).ok()?;
    Some(date.and_time(NaiveTime::MIN))
}

fn as_rrule_time(local: NaiveDateTime) -> DateTime<RTz> {
    RTz::UTC.from_utc_datetime(&local)
}

/// Occurrence starts (local wall-clock) from `from` to `to`, both inclusive.
pub fn occurrences(
    rule: &str,
    start: NaiveDateTime,
    from: NaiveDateTime,
    to: NaiveDateTime,
) -> Result<Vec<NaiveDateTime>, RuleError> {
    if to < from {
        return Ok(Vec::new());
    }
    let parsed: RRule<Unvalidated> = rule.parse().map_err(|_| RuleError::Invalid)?;
    let set = parsed
        .build(as_rrule_time(start))
        .map_err(|_| RuleError::Invalid)?
        .after(as_rrule_time(from))
        .before(as_rrule_time(to));
    Ok(set
        .all(MAX_OCCURRENCES)
        .dates
        .into_iter()
        .map(|d| d.naive_utc())
        .collect())
}

/// The last occurrence at or before `at`, looking back at most `window`.
pub fn latest_before(
    rule: &str,
    start: NaiveDateTime,
    at: NaiveDateTime,
    window: Duration,
) -> Result<Option<NaiveDateTime>, RuleError> {
    Ok(occurrences(rule, start, at - window, at)?
        .into_iter()
        .last())
}

pub fn is_date_only(item: &Item) -> bool {
    item.start_at.is_none() && item.due_date.is_some()
}

/// The stable key of the occurrence starting at `local` in `series`.
pub fn occurrence_key(series: &Item, local: NaiveDateTime) -> String {
    if is_date_only(series) {
        local.date().format(DATE_KEY).to_string()
    } else {
        local.format(TIME_KEY).to_string()
    }
}

pub fn parse_key(key: &str) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(key, TIME_KEY)
        .ok()
        .or_else(|| {
            NaiveDate::parse_from_str(key, DATE_KEY)
                .ok()
                .map(|d| d.and_time(NaiveTime::MIN))
        })
}

pub fn occurrence_id(series_id: &str, key: &str) -> String {
    format!("{series_id}{OCCURRENCE_SEPARATOR}{key}")
}

/// `(series id, occurrence key)` if `id` names a computed occurrence.
pub fn split_occurrence_id(id: &str) -> Option<(&str, &str)> {
    id.split_once(OCCURRENCE_SEPARATOR)
}

/// The item shown for one occurrence of `series` starting at `local`.
pub fn occurrence_item<Tz: TimeZone>(tz: &Tz, series: &Item, local: NaiveDateTime) -> Item {
    let key = occurrence_key(series, local);
    let mut item = series.clone();
    item.id = occurrence_id(&series.id, &key);
    item.recurrence_parent_id = Some(series.id.clone());
    item.original_start_at = Some(key);
    item.completed_at = None;
    item.skipped_at = None;
    if is_date_only(series) {
        item.due_date = Some(local.date().format(DATE_KEY).to_string());
    } else {
        let start = local_to_utc(tz, local);
        let length = series_length(series);
        item.start_at = Some(iso(start));
        item.end_at = length.map(|l| iso(start + l));
    }
    item
}

fn series_length(series: &Item) -> Option<Duration> {
    let parse = |s: &str| DateTime::parse_from_rfc3339(s).ok();
    let start = parse(series.start_at.as_deref()?)?;
    let end = parse(series.end_at.as_deref()?)?;
    Some(end - start)
}

fn iso(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// The rule with its end moved to just before `key` ("this and following" split):
/// any COUNT/UNTIL is replaced by an UNTIL one second before that occurrence.
pub fn ending_before(rule: &str, key: NaiveDateTime) -> String {
    let until = (key - Duration::seconds(1)).format("%Y%m%dT%H%M%SZ");
    let kept: Vec<&str> = rule
        .split(';')
        .filter(|part| {
            !part.starts_with("COUNT=") && !part.starts_with("UNTIL=") && !part.is_empty()
        })
        .collect();
    format!("{};UNTIL={until}", kept.join(";"))
}

#[cfg(test)]
#[path = "recurrence_tests.rs"]
mod tests;
