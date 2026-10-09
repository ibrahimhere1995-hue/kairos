//! Habits & streaks (PRD R13, P3-T02).

use std::collections::BTreeSet;

use chrono::{Duration, NaiveDate, Weekday};
use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::habit::{Habit, HabitInput, HabitStatus};
use crate::models::settings::WeekStart;
use crate::repo::{areas, habits as repo};
use crate::services::app_settings;
use crate::services::habit_logic::{self, Frequency};
use crate::util::{new_id, now_utc};

/// Twelve weeks of history for the heatmap (and enough for streaks shown there).
const HISTORY_DAYS: i64 = 12 * 7;
/// Streaks look back at most this far.
const STREAK_DAYS: i64 = 3 * 366;
const TITLE_MAX: usize = 200;

fn day(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| AppError::invalid("date", "invalidDate"))
}

fn valid(conn: &Connection, input: &HabitInput) -> AppResult<(String, Option<String>, String)> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err(AppError::invalid("title", "required"));
    }
    if title.chars().count() > TITLE_MAX {
        return Err(AppError::invalid("title", "tooLong"));
    }
    let freq =
        Frequency::parse(&input.frequency).ok_or(AppError::invalid("frequency", "outOfRange"))?;
    if let Some(area) = &input.area_id
        && !areas::is_active(conn, area)?
    {
        return Err(AppError::invalid("areaId", "unknownArea"));
    }
    Ok((title.to_owned(), input.area_id.clone(), freq.as_string()))
}

fn active(conn: &Connection, id: &str) -> AppResult<Habit> {
    match repo::get(conn, id)? {
        Some((habit, false)) => Ok(habit),
        _ => Err(AppError::NotFound),
    }
}

pub fn list(conn: &Connection, today: &str) -> AppResult<Vec<HabitStatus>> {
    let today = day(today)?;
    let starts_on = match app_settings::get(conn)?.week_starts_on {
        WeekStart::Monday => Weekday::Mon,
        WeekStart::Sunday => Weekday::Sun,
    };
    let since = (today - Duration::days(STREAK_DAYS))
        .format("%Y-%m-%d")
        .to_string();
    let history_from = today - Duration::days(HISTORY_DAYS - 1);
    let mut out = Vec::new();
    for habit in repo::list_active(conn)? {
        let freq = Frequency::parse(&habit.frequency).unwrap_or(Frequency::Daily);
        let done: BTreeSet<NaiveDate> = repo::log_dates(conn, &habit.id, &since)?
            .iter()
            .filter_map(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
            .collect();
        out.push(HabitStatus {
            done_today: done.contains(&today),
            streak: habit_logic::streak(freq, &done, today, starts_on),
            this_week: habit_logic::this_week(&done, today, starts_on),
            per_week: match freq {
                Frequency::Daily => 7,
                Frequency::Weekly(n) => u32::from(n),
            },
            recent: done
                .range(history_from..=today)
                .map(|d| d.format("%Y-%m-%d").to_string())
                .collect(),
            habit,
        });
    }
    Ok(out)
}

pub fn create(conn: &Connection, input: &HabitInput) -> AppResult<Habit> {
    let (title, area_id, frequency) = valid(conn, input)?;
    let habit = Habit {
        id: new_id(),
        title,
        area_id,
        frequency,
        created_at: now_utc(),
    };
    repo::insert(conn, &habit)?;
    Ok(habit)
}

pub fn update(conn: &Connection, id: &str, input: &HabitInput) -> AppResult<Habit> {
    let mut habit = active(conn, id)?;
    (habit.title, habit.area_id, habit.frequency) = valid(conn, input)?;
    repo::update(conn, &habit, &now_utc())?;
    Ok(habit)
}

/// Soft delete (its ticks stay, so Undo brings everything back).
pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    active(conn, id)?;
    let now = now_utc();
    repo::set_deleted(conn, id, Some(&now), &now)?;
    Ok(())
}

pub fn restore(conn: &Connection, id: &str) -> AppResult<()> {
    repo::get(conn, id)?.ok_or(AppError::NotFound)?;
    repo::set_deleted(conn, id, None, &now_utc())?;
    Ok(())
}

/// Ticks (or unticks) a habit for a local date; not for days that haven't happened yet.
pub fn set_done(conn: &Connection, id: &str, date: &str, today: &str, done: bool) -> AppResult<()> {
    active(conn, id)?;
    if day(date)? > day(today)? {
        return Err(AppError::invalid("date", "invalidDate"));
    }
    if done {
        repo::add_log(conn, &new_id(), id, date, &now_utc())?;
    } else {
        repo::remove_log(conn, id, date)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;

    fn input(title: &str, frequency: &str) -> HabitInput {
        HabitInput {
            title: title.into(),
            area_id: None,
            frequency: frequency.into(),
        }
    }

    #[test]
    fn create_tick_and_see_the_streak() {
        let c = migrated_conn();
        let h = create(&c, &input(" Read ", "daily")).unwrap();
        assert_eq!(h.title, "Read");
        for d in ["2026-10-06", "2026-10-07", "2026-10-08"] {
            set_done(&c, &h.id, d, "2026-10-08", true).unwrap();
        }
        set_done(&c, &h.id, "2026-10-08", "2026-10-08", true).unwrap(); // twice is fine
        let s = &list(&c, "2026-10-08").unwrap()[0];
        assert!(s.done_today);
        assert_eq!((s.streak, s.this_week, s.per_week), (3, 3, 7));
        assert_eq!(s.recent.len(), 3);

        set_done(&c, &h.id, "2026-10-08", "2026-10-08", false).unwrap();
        let s = &list(&c, "2026-10-08").unwrap()[0];
        assert!(!s.done_today);
        assert_eq!(s.streak, 2, "today can still be ticked");
    }

    #[test]
    fn validation_and_future_days() {
        let c = migrated_conn();
        assert!(create(&c, &input("  ", "daily")).is_err());
        assert!(create(&c, &input("Run", "weekly:9")).is_err());
        let h = create(&c, &input("Run", "weekly:3")).unwrap();
        assert!(
            set_done(&c, &h.id, "2026-10-09", "2026-10-08", true).is_err(),
            "not tomorrow"
        );
        let s = &list(&c, "2026-10-08").unwrap()[0];
        assert_eq!(s.per_week, 3);
    }

    #[test]
    fn delete_hides_and_restore_brings_back_with_ticks() {
        let c = migrated_conn();
        let h = create(&c, &input("Stretch", "daily")).unwrap();
        set_done(&c, &h.id, "2026-10-08", "2026-10-08", true).unwrap();
        delete(&c, &h.id).unwrap();
        assert!(list(&c, "2026-10-08").unwrap().is_empty());
        assert!(set_done(&c, &h.id, "2026-10-08", "2026-10-08", true).is_err());
        restore(&c, &h.id).unwrap();
        assert!(list(&c, "2026-10-08").unwrap()[0].done_today);
    }

    #[test]
    fn update_changes_title_and_frequency() {
        let c = migrated_conn();
        let h = create(&c, &input("Gym", "daily")).unwrap();
        let u = update(&c, &h.id, &input("Gym session", "weekly:2")).unwrap();
        assert_eq!(
            (u.title.as_str(), u.frequency.as_str()),
            ("Gym session", "weekly:2")
        );
    }
}
