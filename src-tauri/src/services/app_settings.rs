//! Settings (P1-T16, P2-T01–T04), one JSON value per key in the `settings` table.

use chrono::NaiveDate;
use rusqlite::Connection;
use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::error::{AppError, AppResult};
use crate::models::settings::AppSettings;
use crate::repo::settings;

const THEME: &str = "ui.theme";
const TEXT_SIZE: &str = "ui.textSize";
const WEEK_START: &str = "calendar.weekStartsOn";
const REMINDER_TIME: &str = "reminders.defaultTime";
const SUMMARY_ENABLED: &str = "reminders.dailySummary";
const SUMMARY_TIME: &str = "reminders.dailySummaryTime";
const LAUNCH_AT_LOGIN: &str = "system.launchAtLogin";
const NAME: &str = "profile.name";
const REVIEW_DAY: &str = "review.day";
const WORK_START: &str = "planning.dayStart";
const WORK_END: &str = "planning.dayEnd";
pub const NAME_MAX_CHARS: usize = 40;
/// Internal: the local date the last daily summary was sent for.
const SUMMARY_LAST_SENT: &str = "reminders.dailySummaryLastSent";
/// Internal: whether the "still running in the tray" hint has been shown.
const TRAY_HINT_SHOWN: &str = "ui.trayHintShown";
/// Internal: when smart features were agreed to (not part of AppSettings: changed only there).
const AI_CONSENT: &str = "ai.consentAt";

/// Missing or unreadable values fall back to the default, so a bad value never blocks the app.
fn read<T: DeserializeOwned>(conn: &Connection, key: &str, default: T) -> AppResult<T> {
    Ok(settings::get(conn, key)?
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or(default))
}

fn write<T: Serialize>(conn: &Connection, key: &str, value: &T) -> AppResult<()> {
    let json =
        serde_json::to_string(value).map_err(|_| AppError::invalid("settings", "outOfRange"))?;
    settings::set(conn, key, &json)?;
    Ok(())
}

fn is_valid_time(value: &str) -> bool {
    let Some((h, m)) = value.split_once(':') else {
        return false;
    };
    h.len() == 2
        && m.len() == 2
        && h.parse::<u8>().is_ok_and(|h| h < 24)
        && m.parse::<u8>().is_ok_and(|m| m < 60)
}

fn read_time(conn: &Connection, key: &str, default: String) -> AppResult<String> {
    let saved: String = read(conn, key, default.clone())?;
    Ok(if is_valid_time(&saved) {
        saved
    } else {
        default
    })
}

pub fn get(conn: &Connection) -> AppResult<AppSettings> {
    let defaults = AppSettings::default();
    Ok(AppSettings {
        theme: read(conn, THEME, defaults.theme)?,
        text_size: read(conn, TEXT_SIZE, defaults.text_size)?,
        week_starts_on: read(conn, WEEK_START, defaults.week_starts_on)?,
        default_reminder_time: read_time(conn, REMINDER_TIME, defaults.default_reminder_time)?,
        daily_summary_enabled: read(conn, SUMMARY_ENABLED, defaults.daily_summary_enabled)?,
        daily_summary_time: read_time(conn, SUMMARY_TIME, defaults.daily_summary_time)?,
        launch_at_login: read(conn, LAUNCH_AT_LOGIN, defaults.launch_at_login)?,
        name: read(conn, NAME, defaults.name)?,
        review_day: read(conn, REVIEW_DAY, defaults.review_day)?,
        work_day_start: read_time(conn, WORK_START, defaults.work_day_start)?,
        work_day_end: read_time(conn, WORK_END, defaults.work_day_end)?,
    })
}

/// Saves all settings at once, in one transaction.
pub fn update(conn: &mut Connection, next: &AppSettings) -> AppResult<AppSettings> {
    if !is_valid_time(&next.default_reminder_time) {
        return Err(AppError::invalid("defaultReminderTime", "invalidDateTime"));
    }
    if !is_valid_time(&next.daily_summary_time) {
        return Err(AppError::invalid("dailySummaryTime", "invalidDateTime"));
    }
    if !is_valid_time(&next.work_day_start) || !is_valid_time(&next.work_day_end) {
        return Err(AppError::invalid("workDay", "invalidDateTime"));
    }
    // Same-format `HH:mm` strings compare like times.
    if next.work_day_start >= next.work_day_end {
        return Err(AppError::invalid("workDay", "workHoursOrder"));
    }
    let name = valid_name(&next.name)?;
    let tx = conn.transaction()?;
    write(&tx, NAME, &name)?;
    write(&tx, THEME, &next.theme)?;
    write(&tx, TEXT_SIZE, &next.text_size)?;
    write(&tx, WEEK_START, &next.week_starts_on)?;
    write(&tx, REMINDER_TIME, &next.default_reminder_time)?;
    write(&tx, SUMMARY_ENABLED, &next.daily_summary_enabled)?;
    write(&tx, SUMMARY_TIME, &next.daily_summary_time)?;
    write(&tx, LAUNCH_AT_LOGIN, &next.launch_at_login)?;
    write(&tx, REVIEW_DAY, &next.review_day)?;
    write(&tx, WORK_START, &next.work_day_start)?;
    write(&tx, WORK_END, &next.work_day_end)?;
    tx.commit()?;
    get(conn)
}

/// Trimmed; at most `NAME_MAX_CHARS` characters.
pub fn valid_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.chars().count() > NAME_MAX_CHARS {
        return Err(AppError::invalid("name", "tooLong"));
    }
    Ok(name.to_owned())
}

pub fn summary_last_sent(conn: &Connection) -> AppResult<Option<NaiveDate>> {
    let saved: Option<String> = read(conn, SUMMARY_LAST_SENT, None)?;
    Ok(saved.and_then(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok()))
}

pub fn set_summary_last_sent(conn: &Connection, date: NaiveDate) -> AppResult<()> {
    write(
        conn,
        SUMMARY_LAST_SENT,
        &date.format("%Y-%m-%d").to_string(),
    )
}

/// When the user agreed to the smart features consent screen (PRD §7.3); None = not yet.
pub fn ai_consented_at(conn: &Connection) -> AppResult<Option<String>> {
    read(conn, AI_CONSENT, None)
}

pub fn set_ai_consent(conn: &Connection, given: bool) -> AppResult<()> {
    write(conn, AI_CONSENT, &given.then(crate::util::now_utc))
}

/// True only the first time it is called: the tray hint is shown once.
pub fn take_tray_hint(conn: &Connection) -> AppResult<bool> {
    let shown: bool = read(conn, TRAY_HINT_SHOWN, false)?;
    if !shown {
        write(conn, TRAY_HINT_SHOWN, &true)?;
    }
    Ok(!shown)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;
    use crate::models::settings::{TextSize, ThemePreference, WeekStart, Weekday};

    #[test]
    fn defaults_when_nothing_is_saved() {
        let c = migrated_conn();
        let s = get(&c).unwrap();
        assert_eq!(s, AppSettings::default());
        assert_eq!(s.default_reminder_time, "09:00");
        assert_eq!(s.daily_summary_time, "08:00");
        assert!(s.daily_summary_enabled);
        assert!(s.launch_at_login, "PRD R3: on by default");
    }

    #[test]
    fn remembers_ai_consent() {
        let c = migrated_conn();
        assert_eq!(ai_consented_at(&c).unwrap(), None);
        set_ai_consent(&c, true).unwrap();
        assert!(ai_consented_at(&c).unwrap().is_some());
        set_ai_consent(&c, false).unwrap();
        assert_eq!(ai_consented_at(&c).unwrap(), None);
    }

    #[test]
    fn saves_and_reads_back() {
        let mut c = migrated_conn();
        let next = AppSettings {
            theme: ThemePreference::Dark,
            text_size: TextSize::Xl,
            week_starts_on: WeekStart::Sunday,
            default_reminder_time: "07:30".into(),
            daily_summary_enabled: false,
            daily_summary_time: "06:45".into(),
            launch_at_login: false,
            name: "Zack".into(),
            review_day: Weekday::Friday,
            work_day_start: "08:30".into(),
            work_day_end: "17:00".into(),
        };
        assert_eq!(update(&mut c, &next).unwrap(), next);
        assert_eq!(get(&c).unwrap(), next);
    }

    #[test]
    fn working_hours_must_run_forwards() {
        let mut c = migrated_conn();
        let backwards = AppSettings {
            work_day_start: "18:00".into(),
            work_day_end: "09:00".into(),
            ..AppSettings::default()
        };
        assert!(update(&mut c, &backwards).is_err());
        let bad = AppSettings {
            work_day_end: "25:00".into(),
            ..AppSettings::default()
        };
        assert!(update(&mut c, &bad).is_err());
    }

    #[test]
    fn rejects_bad_times_and_ignores_corrupt_values() {
        let mut c = migrated_conn();
        for bad in ["9:00", "24:00", "12:60", "noon", ""] {
            let reminder = AppSettings {
                default_reminder_time: bad.into(),
                ..AppSettings::default()
            };
            assert!(update(&mut c, &reminder).is_err(), "{bad} must be rejected");
            let summary = AppSettings {
                daily_summary_time: bad.into(),
                ..AppSettings::default()
            };
            assert!(update(&mut c, &summary).is_err(), "{bad} must be rejected");
        }
        settings::set(&c, THEME, "\"purple\"").unwrap();
        settings::set(&c, SUMMARY_TIME, "\"25:00\"").unwrap();
        let s = get(&c).unwrap();
        assert_eq!(s.theme, ThemePreference::System, "unknown value → default");
        assert_eq!(s.daily_summary_time, "08:00");
    }

    #[test]
    fn remembers_the_last_summary_date() {
        let c = migrated_conn();
        assert_eq!(summary_last_sent(&c).unwrap(), None);
        let day = NaiveDate::from_ymd_opt(2026, 10, 8).unwrap();
        set_summary_last_sent(&c, day).unwrap();
        assert_eq!(summary_last_sent(&c).unwrap(), Some(day));
    }

    #[test]
    fn tray_hint_only_once() {
        let c = migrated_conn();
        assert!(take_tray_hint(&c).unwrap());
        assert!(!take_tray_hint(&c).unwrap());
    }
}
