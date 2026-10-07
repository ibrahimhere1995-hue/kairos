//! Validation and normalisation for item input (commands validate; services enforce).

use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::inputs::{ItemInput, ScheduleInput};
use crate::models::item::ItemKind;
use crate::repo::areas;

pub const TITLE_MAX_CHARS: usize = 500;
pub const LOCATION_MAX_CHARS: usize = 500;
pub const NOTES_MAX_CHARS: usize = 100_000;

/// A validated schedule: timestamps normalised to `YYYY-MM-DDTHH:MM:SS.sssZ` so that
/// string comparison in SQL matches time order.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Schedule {
    pub start_at: Option<String>,
    pub end_at: Option<String>,
    pub due_date: Option<String>,
}

impl Schedule {
    pub fn is_empty(&self) -> bool {
        self.start_at.is_none() && self.end_at.is_none() && self.due_date.is_none()
    }
}

/// Validated, cleaned editor fields.
#[derive(Debug, Clone)]
pub struct ValidItem {
    pub kind: ItemKind,
    pub title: String,
    pub notes: Option<String>,
    pub area_id: Option<String>,
    pub priority: i32,
    pub location: Option<String>,
    pub schedule: Schedule,
}

pub fn normalize_instant(field: &'static str, value: &str) -> AppResult<String> {
    DateTime::parse_from_rfc3339(value.trim())
        .map(|dt| {
            dt.with_timezone(&Utc)
                .to_rfc3339_opts(SecondsFormat::Millis, true)
        })
        .map_err(|_| AppError::invalid(field, "invalidDateTime"))
}

pub fn normalize_date(field: &'static str, value: &str) -> AppResult<String> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d")
        .map(|d| d.format("%Y-%m-%d").to_string())
        .map_err(|_| AppError::invalid(field, "invalidDate"))
}

fn optional<T>(value: Option<&str>, f: impl Fn(&str) -> AppResult<T>) -> AppResult<Option<T>> {
    value.map(f).transpose()
}

pub fn validate_schedule(kind: ItemKind, input: &ScheduleInput) -> AppResult<Schedule> {
    let schedule = Schedule {
        start_at: optional(input.start_at.as_deref(), |v| {
            normalize_instant("startAt", v)
        })?,
        end_at: optional(input.end_at.as_deref(), |v| normalize_instant("endAt", v))?,
        due_date: optional(input.due_date.as_deref(), |v| normalize_date("dueDate", v))?,
    };

    if schedule.due_date.is_some() && (schedule.start_at.is_some() || schedule.end_at.is_some()) {
        return Err(AppError::invalid("dueDate", "conflictsWithTime"));
    }
    match (&schedule.start_at, &schedule.end_at) {
        (None, Some(_)) => return Err(AppError::invalid("endAt", "requiresStart")),
        (Some(start), Some(end)) if end <= start => {
            return Err(AppError::invalid("endAt", "beforeStart"));
        }
        _ => {}
    }
    if kind == ItemKind::Event {
        if schedule.is_empty() {
            return Err(AppError::invalid("startAt", "eventNeedsDate"));
        }
        if schedule.start_at.is_some() && schedule.end_at.is_none() {
            return Err(AppError::invalid("endAt", "eventNeedsEnd"));
        }
    }
    Ok(schedule)
}

/// Trims text; blank becomes `None`.
fn clean(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_owned)
}

fn check_len(field: &'static str, value: &Option<String>, max: usize) -> AppResult<()> {
    match value {
        Some(v) if v.chars().count() > max => Err(AppError::invalid(field, "tooLong")),
        _ => Ok(()),
    }
}

pub fn validate_item(conn: &Connection, input: &ItemInput) -> AppResult<ValidItem> {
    let title = clean(Some(&input.title)).ok_or(AppError::invalid("title", "required"))?;
    check_len("title", &Some(title.clone()), TITLE_MAX_CHARS)?;

    // Notes keep their inner formatting (markdown); only fully blank notes are dropped.
    let notes = input.notes.clone().filter(|n| !n.trim().is_empty());
    check_len("notes", &notes, NOTES_MAX_CHARS)?;

    let location = clean(input.location.as_deref());
    check_len("location", &location, LOCATION_MAX_CHARS)?;

    if !(0..=3).contains(&input.priority) {
        return Err(AppError::invalid("priority", "outOfRange"));
    }

    let area_id = clean(input.area_id.as_deref());
    if let Some(id) = &area_id
        && !areas::is_active(conn, id)?
    {
        return Err(AppError::invalid("areaId", "unknownArea"));
    }

    let schedule = validate_schedule(
        input.kind,
        &ScheduleInput {
            start_at: input.start_at.clone(),
            end_at: input.end_at.clone(),
            due_date: input.due_date.clone(),
        },
    )?;

    Ok(ValidItem {
        kind: input.kind,
        title,
        notes,
        area_id,
        priority: input.priority,
        location,
        schedule,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sched(start: Option<&str>, end: Option<&str>, due: Option<&str>) -> ScheduleInput {
        ScheduleInput {
            start_at: start.map(Into::into),
            end_at: end.map(Into::into),
            due_date: due.map(Into::into),
        }
    }

    fn reason(err: AppError) -> (&'static str, &'static str) {
        match err {
            AppError::Validation { field, reason } => (field, reason),
            other => panic!("expected validation error, got {other:?}"),
        }
    }

    #[test]
    fn timestamps_are_normalised_to_utc_millis() {
        assert_eq!(
            normalize_instant("startAt", "2026-10-07T10:00:00+02:00").unwrap(),
            "2026-10-07T08:00:00.000Z"
        );
        assert_eq!(
            normalize_instant("startAt", "2026-10-07T08:00:00Z").unwrap(),
            "2026-10-07T08:00:00.000Z"
        );
    }

    #[test]
    fn dst_offsets_normalise_to_the_same_instant() {
        // 01:30 on the US "fall back" day happens twice; offsets disambiguate it.
        let first = normalize_instant("startAt", "2026-11-01T01:30:00-04:00").unwrap();
        let second = normalize_instant("startAt", "2026-11-01T01:30:00-05:00").unwrap();
        assert_eq!(first, "2026-11-01T05:30:00.000Z");
        assert_eq!(second, "2026-11-01T06:30:00.000Z");
    }

    #[test]
    fn rejects_bad_dates_and_times() {
        assert_eq!(
            reason(normalize_instant("startAt", "tomorrow").unwrap_err()),
            ("startAt", "invalidDateTime")
        );
        assert_eq!(
            reason(normalize_date("dueDate", "2026-02-30").unwrap_err()),
            ("dueDate", "invalidDate")
        );
    }

    #[test]
    fn date_only_and_timed_cannot_mix() {
        let err = validate_schedule(
            ItemKind::Task,
            &sched(Some("2026-10-07T08:00:00Z"), None, Some("2026-10-07")),
        )
        .unwrap_err();
        assert_eq!(reason(err), ("dueDate", "conflictsWithTime"));
    }

    #[test]
    fn end_must_follow_start() {
        let err = validate_schedule(
            ItemKind::Event,
            &sched(
                Some("2026-10-07T09:00:00Z"),
                Some("2026-10-07T09:00:00Z"),
                None,
            ),
        )
        .unwrap_err();
        assert_eq!(reason(err), ("endAt", "beforeStart"));

        let err = validate_schedule(
            ItemKind::Task,
            &sched(None, Some("2026-10-07T09:00:00Z"), None),
        )
        .unwrap_err();
        assert_eq!(reason(err), ("endAt", "requiresStart"));
    }

    #[test]
    fn events_need_a_date_and_timed_events_need_an_end() {
        let err = validate_schedule(ItemKind::Event, &sched(None, None, None)).unwrap_err();
        assert_eq!(reason(err), ("startAt", "eventNeedsDate"));

        let err = validate_schedule(
            ItemKind::Event,
            &sched(Some("2026-10-07T09:00:00Z"), None, None),
        )
        .unwrap_err();
        assert_eq!(reason(err), ("endAt", "eventNeedsEnd"));

        // All-day event: date only is fine.
        assert!(validate_schedule(ItemKind::Event, &sched(None, None, Some("2026-10-07"))).is_ok());
    }

    #[test]
    fn tasks_may_be_unscheduled() {
        let s = validate_schedule(ItemKind::Task, &sched(None, None, None)).unwrap();
        assert!(s.is_empty());
    }
}
