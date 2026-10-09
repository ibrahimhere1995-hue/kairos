//! A5 — energy-aware scheduling (PRD §7.3, P3-T13): learns, on this computer only, the hours
//! you tick most tasks done. The AI never sees the history; Plan my day only gets the range.

use chrono::{DateTime, Duration, TimeZone, Timelike, Utc};
use rusqlite::Connection;

use crate::error::AppResult;
use crate::models::ai::BestHours;
use crate::repo::items;

/// Look back this far.
const WEEKS: i64 = 8;
/// Too few completions say nothing about a pattern.
const MIN_DONE: usize = 20;
/// The best two hours must hold at least this share of everything done.
const MIN_SHARE: f64 = 0.25;
const WINDOW: u32 = 2;

/// The two-hour window (local time) with the most completions, if there is a clear one.
pub fn from_hours(hours: &[u32]) -> Option<BestHours> {
    if hours.len() < MIN_DONE {
        return None;
    }
    let mut counts = [0usize; 24];
    for h in hours {
        if let Some(c) = counts.get_mut(*h as usize) {
            *c += 1;
        }
    }
    // Windows never wrap past midnight; on a tie the earlier window wins.
    let (start, done) = (0..=24 - WINDOW)
        .map(|s| {
            (
                s,
                (s..s + WINDOW).map(|h| counts[h as usize]).sum::<usize>(),
            )
        })
        .fold((0, 0), |best, cur| if cur.1 > best.1 { cur } else { best });
    let share = done as f64 / hours.len() as f64;
    (share >= MIN_SHARE).then(|| BestHours {
        start_hour: start,
        end_hour: start + WINDOW,
        done: u32::try_from(done).unwrap_or(u32::MAX),
        total: u32::try_from(hours.len()).unwrap_or(u32::MAX),
    })
}

pub fn best_hours<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    now: DateTime<Utc>,
) -> AppResult<Option<BestHours>> {
    let since = (now - Duration::weeks(WEEKS)).to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let hours: Vec<u32> = items::completion_times(conn, &since)?
        .iter()
        .filter_map(|t| DateTime::parse_from_rfc3339(t).ok())
        .map(|t| t.with_timezone(tz).hour())
        .collect();
    Ok(from_hours(&hours))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;
    use crate::models::inputs::ItemInput;
    use crate::models::item::ItemKind;
    use crate::scheduler::timing::tests::London;
    use crate::services::items as item_service;

    fn hours(spec: &[(u32, usize)]) -> Vec<u32> {
        spec.iter()
            .flat_map(|(h, n)| std::iter::repeat_n(*h, *n))
            .collect()
    }

    #[test]
    fn finds_the_busiest_two_hours() {
        let best = from_hours(&hours(&[(9, 8), (10, 6), (14, 4), (20, 4)])).unwrap();
        assert_eq!(
            (best.start_hour, best.end_hour, best.done, best.total),
            (9, 11, 14, 22)
        );
    }

    #[test]
    fn says_nothing_without_enough_history_or_a_clear_pattern() {
        assert_eq!(from_hours(&hours(&[(9, 19)])), None);
        let spread: Vec<u32> = (0..24).chain(0..24).collect();
        assert_eq!(from_hours(&spread), None, "even spread: no best hours");
    }

    #[test]
    fn reads_completions_in_local_time_and_skips_old_ones() {
        let mut c = migrated_conn();
        let input = ItemInput {
            kind: ItemKind::Task,
            title: "Done".into(),
            notes: None,
            area_id: None,
            priority: 0,
            start_at: None,
            end_at: None,
            due_date: None,
            location: None,
            source: None,
            reminders: Some(vec![]),
            rrule: None,
            milestone_id: None,
        };
        for i in 0..25 {
            let id = item_service::create(&mut c, &input).unwrap().id;
            // 08:xx UTC in summer = 09:xx in London.
            let at = if i < 20 {
                "2026-07-10T08:15:00.000Z"
            } else {
                "2026-01-10T08:15:00.000Z"
            };
            c.execute(
                "UPDATE items SET completed_at = ?1 WHERE id = ?2",
                [at, &id],
            )
            .unwrap();
        }
        let now = "2026-07-20T12:00:00Z".parse().unwrap();
        let best = best_hours(&c, &London, now).unwrap().unwrap();
        assert_eq!(
            (best.start_hour, best.total),
            (8, 20),
            "January completions are too old"
        );
        assert!(best.start_hour <= 9 && 9 < best.end_hour);
    }
}
