//! Which backups to keep (PRD R5): automatic ones → the newest per day for the last 14 days
//! that have backups, then the newest per ISO week for 8 more weeks. Safety copies (before a
//! restore, migration or purge) → the newest 10 of each kind. Manual backups are never removed.

use std::collections::HashSet;

use chrono::{DateTime, Datelike, NaiveDate, Utc};

pub const DAILY_KEEP: usize = 14;
pub const WEEKLY_KEEP: usize = 8;
pub const SAFETY_KEEP: usize = 10;

/// Automatic backups to delete, given `(file name, created at)`.
pub fn automatic_to_delete(backups: &[(String, DateTime<Utc>)]) -> Vec<String> {
    let mut sorted: Vec<&(String, DateTime<Utc>)> = backups.iter().collect();
    sorted.sort_by_key(|b| std::cmp::Reverse(b.1)); // newest first

    let mut keep: HashSet<&str> = HashSet::new();
    let mut days: Vec<NaiveDate> = Vec::new();
    for (name, at) in &sorted {
        let day = at.date_naive();
        if days.contains(&day) {
            continue;
        }
        if days.len() < DAILY_KEEP {
            days.push(day);
            keep.insert(name);
        }
    }

    let oldest_daily = days.last().copied();
    let mut weeks: Vec<(i32, u32)> = Vec::new();
    for (name, at) in &sorted {
        let day = at.date_naive();
        if oldest_daily.is_some_and(|oldest| day >= oldest) {
            continue; // inside the daily window
        }
        let week = (day.iso_week().year(), day.iso_week().week());
        if !weeks.contains(&week) && weeks.len() < WEEKLY_KEEP {
            weeks.push(week);
            keep.insert(name);
        }
    }

    sorted
        .iter()
        .filter(|(name, _)| !keep.contains(name.as_str()))
        .map(|(name, _)| name.clone())
        .collect()
}

/// Safety copies of one kind to delete: everything but the newest `SAFETY_KEEP`.
pub fn safety_to_delete(backups: &[(String, DateTime<Utc>)]) -> Vec<String> {
    let mut sorted: Vec<&(String, DateTime<Utc>)> = backups.iter().collect();
    sorted.sort_by_key(|b| std::cmp::Reverse(b.1));
    sorted
        .into_iter()
        .skip(SAFETY_KEEP)
        .map(|(name, _)| name.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, TimeZone};

    fn at(days_ago: i64, hour: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 10, 8, hour, 0, 0).unwrap() - Duration::days(days_ago)
    }

    fn named(list: &[(i64, u32)]) -> Vec<(String, DateTime<Utc>)> {
        list.iter()
            .map(|&(d, h)| (format!("d{d}h{h}"), at(d, h)))
            .collect()
    }

    #[test]
    fn keeps_everything_while_young() {
        let backups = named(&[(0, 9), (1, 9), (2, 9)]);
        assert!(automatic_to_delete(&backups).is_empty());
    }

    #[test]
    fn keeps_only_the_newest_backup_of_each_day() {
        let backups = named(&[(0, 18), (0, 9), (0, 7), (1, 9)]);
        let mut deleted = automatic_to_delete(&backups);
        deleted.sort();
        assert_eq!(deleted, ["d0h7", "d0h9"]);
    }

    #[test]
    fn keeps_14_daily_then_8_weekly() {
        // One backup a day for 200 days.
        let backups = named(&(0..200).map(|d| (d, 12)).collect::<Vec<_>>());
        let deleted = automatic_to_delete(&backups);
        let kept: Vec<&String> = backups
            .iter()
            .map(|(n, _)| n)
            .filter(|n| !deleted.contains(n))
            .collect();
        assert_eq!(kept.len(), DAILY_KEEP + WEEKLY_KEEP);
        for d in 0..14 {
            assert!(kept.contains(&&format!("d{d}h12")), "day {d} kept");
        }
        assert!(deleted.contains(&"d199h12".to_string()), "oldest goes");
    }

    #[test]
    fn days_without_backups_do_not_count() {
        // Laptop off for a month: the 14 most recent *backup days* are kept, not 14 calendar days.
        let backups = named(&(0..10).chain(40..50).map(|d| (d, 12)).collect::<Vec<_>>());
        let deleted = automatic_to_delete(&backups);
        for d in (0..10).chain(40..44) {
            assert!(!deleted.contains(&format!("d{d}h12")), "day {d} kept");
        }
    }

    #[test]
    fn safety_copies_keep_the_newest_ten() {
        let backups = named(&(0..15).map(|d| (d, 12)).collect::<Vec<_>>());
        let mut deleted = safety_to_delete(&backups);
        deleted.sort();
        assert_eq!(deleted.len(), 5);
        assert!(deleted.contains(&"d14h12".to_string()));
        assert!(!deleted.contains(&"d0h12".to_string()));
    }
}
