//! Focus mode (PRD R16, P3-T05): log focused time. The timer itself lives in the UI.

use std::collections::BTreeMap;

use chrono::{DateTime, Duration, SecondsFormat, Utc};
use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::focus::{FocusSession, FocusTotal};
use crate::repo::{focus as repo, items};
use crate::services::item_rules::normalize_instant;
use crate::util::new_id;

pub const MINUTES_MAX: i64 = 180;

fn parse(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|t| t.with_timezone(&Utc))
}

fn iso(at: DateTime<Utc>) -> String {
    at.to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// Starts logging focused work, on a task or on nothing in particular. A computed
/// occurrence (`series@key`) is logged against its series.
pub fn start(
    conn: &Connection,
    item_id: Option<&str>,
    planned_minutes: i64,
    now: DateTime<Utc>,
) -> AppResult<FocusSession> {
    if !(1..=MINUTES_MAX).contains(&planned_minutes) {
        return Err(AppError::invalid("plannedMinutes", "outOfRange"));
    }
    let item_id = item_id.map(|id| id.split('@').next().unwrap_or(id).to_owned());
    if let Some(id) = &item_id
        && !items::get(conn, id)?.is_some_and(|i| i.deleted_at.is_none())
    {
        return Err(AppError::NotFound);
    }
    close_stale(conn, now)?;
    let session = FocusSession {
        id: new_id(),
        item_id,
        started_at: iso(now),
        ended_at: None,
        planned_minutes,
    };
    repo::insert(conn, &session, &session.started_at)?;
    Ok(session)
}

pub fn stop(conn: &Connection, id: &str, now: DateTime<Utc>) -> AppResult<()> {
    repo::end(conn, id, &iso(now))?;
    Ok(())
}

/// Ends sessions left open (the app closed mid-focus), counting at most their planned time.
pub fn close_stale(conn: &Connection, now: DateTime<Utc>) -> AppResult<()> {
    for (id, started_at, planned) in repo::list_open(conn)? {
        let end = parse(&started_at)
            .map(|start| (start + Duration::minutes(planned)).min(now).max(start))
            .unwrap_or(now);
        repo::end(conn, &id, &iso(end))?;
    }
    Ok(())
}

/// Focused seconds per life area for sessions started in `[start, end)`.
pub fn totals(conn: &Connection, start: &str, end: &str) -> AppResult<Vec<FocusTotal>> {
    let start = normalize_instant("start", start)?;
    let end = normalize_instant("end", end)?;
    let mut by_area: BTreeMap<Option<String>, i64> = BTreeMap::new();
    for (area_id, from, to) in repo::finished_between(conn, &start, &end)? {
        if let (Some(from), Some(to)) = (parse(&from), parse(&to)) {
            *by_area.entry(area_id).or_default() += (to - from).num_seconds().max(0);
        }
    }
    Ok(by_area
        .into_iter()
        .map(|(area_id, seconds)| FocusTotal { area_id, seconds })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;
    use crate::models::inputs::ItemInput;
    use crate::models::item::ItemKind;
    use crate::services::items as item_service;

    fn at(s: &str) -> DateTime<Utc> {
        parse(s).unwrap()
    }

    fn task(c: &mut Connection, area_id: Option<String>) -> String {
        item_service::create(
            c,
            &ItemInput {
                kind: ItemKind::Task,
                title: "Write report".into(),
                notes: None,
                area_id,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: None,
                location: None,
                source: None,
                reminders: Some(vec![]),
                rrule: None,
                milestone_id: None,
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn logs_time_per_area_and_ignores_open_sessions() {
        let mut c = migrated_conn();
        crate::services::seed::seed_defaults(&mut c).unwrap();
        let area = crate::repo::areas::list_active(&c).unwrap()[0].id.clone();
        let id = task(&mut c, Some(area.clone()));
        let a = start(&c, Some(&id), 25, at("2026-10-05T09:00:00Z")).unwrap();
        stop(&c, &a.id, at("2026-10-05T09:25:00Z")).unwrap();
        stop(&c, &a.id, at("2026-10-05T11:00:00Z")).unwrap(); // already ended: unchanged
        let b = start(&c, None, 25, at("2026-10-05T10:00:00Z")).unwrap();
        stop(&c, &b.id, at("2026-10-05T10:10:00Z")).unwrap();
        start(&c, None, 25, at("2026-10-05T12:00:00Z")).unwrap(); // still running

        let totals = totals(&c, "2026-10-05T00:00:00Z", "2026-10-06T00:00:00Z").unwrap();
        assert_eq!(
            totals,
            vec![
                FocusTotal {
                    area_id: None,
                    seconds: 600
                },
                FocusTotal {
                    area_id: Some(area),
                    seconds: 1500
                },
            ]
        );
        assert!(totals_outside_range_are_empty(&c));
    }

    fn totals_outside_range_are_empty(c: &Connection) -> bool {
        totals(c, "2026-10-06T00:00:00Z", "2026-10-07T00:00:00Z")
            .unwrap()
            .is_empty()
    }

    #[test]
    fn a_new_session_closes_a_forgotten_one_at_its_planned_end() {
        let c = migrated_conn();
        start(&c, None, 25, at("2026-10-05T09:00:00Z")).unwrap();
        start(&c, None, 25, at("2026-10-05T15:00:00Z")).unwrap();
        let t = totals(&c, "2026-10-05T00:00:00Z", "2026-10-06T00:00:00Z").unwrap();
        assert_eq!(t[0].seconds, 25 * 60);
    }

    #[test]
    fn occurrences_log_against_their_series_and_bad_input_is_refused() {
        let mut c = migrated_conn();
        let id = task(&mut c, None);
        let s = start(
            &c,
            Some(&format!("{id}@2026-10-05")),
            25,
            at("2026-10-05T09:00:00Z"),
        );
        assert_eq!(s.unwrap().item_id, Some(id));
        assert!(start(&c, None, 0, Utc::now()).is_err());
        assert!(start(&c, None, MINUTES_MAX + 1, Utc::now()).is_err());
        assert!(matches!(
            start(&c, Some("missing"), 25, Utc::now()),
            Err(AppError::NotFound)
        ));
    }
}
