//! Basic settings (P1-T16), one JSON value per key in the `settings` table.

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

/// Missing or unreadable values fall back to the default, so a bad value never blocks the app.
fn read<T: DeserializeOwned>(conn: &Connection, key: &str, default: T) -> AppResult<T> {
    Ok(settings::get(conn, key)?
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or(default))
}

fn write<T: Serialize>(conn: &Connection, key: &str, value: &T) -> AppResult<()> {
    let json = serde_json::to_string(value)
        .map_err(|_| AppError::invalid(key_field(key), "outOfRange"))?;
    settings::set(conn, key, &json)?;
    Ok(())
}

fn key_field(key: &str) -> &'static str {
    match key {
        THEME => "theme",
        TEXT_SIZE => "textSize",
        WEEK_START => "weekStartsOn",
        _ => "defaultReminderTime",
    }
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

pub fn get(conn: &Connection) -> AppResult<AppSettings> {
    let defaults = AppSettings::default();
    let reminder: String = read(conn, REMINDER_TIME, defaults.default_reminder_time.clone())?;
    Ok(AppSettings {
        theme: read(conn, THEME, defaults.theme)?,
        text_size: read(conn, TEXT_SIZE, defaults.text_size)?,
        week_starts_on: read(conn, WEEK_START, defaults.week_starts_on)?,
        default_reminder_time: if is_valid_time(&reminder) {
            reminder
        } else {
            defaults.default_reminder_time
        },
    })
}

/// Saves all settings at once, in one transaction.
pub fn update(conn: &mut Connection, next: &AppSettings) -> AppResult<AppSettings> {
    if !is_valid_time(&next.default_reminder_time) {
        return Err(AppError::invalid("defaultReminderTime", "invalidDateTime"));
    }
    let tx = conn.transaction()?;
    write(&tx, THEME, &next.theme)?;
    write(&tx, TEXT_SIZE, &next.text_size)?;
    write(&tx, WEEK_START, &next.week_starts_on)?;
    write(&tx, REMINDER_TIME, &next.default_reminder_time)?;
    tx.commit()?;
    get(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;
    use crate::models::settings::{TextSize, ThemePreference, WeekStart};

    #[test]
    fn defaults_when_nothing_is_saved() {
        let c = migrated_conn();
        assert_eq!(get(&c).unwrap(), AppSettings::default());
        assert_eq!(get(&c).unwrap().default_reminder_time, "09:00");
    }

    #[test]
    fn saves_and_reads_back() {
        let mut c = migrated_conn();
        let next = AppSettings {
            theme: ThemePreference::Dark,
            text_size: TextSize::Xl,
            week_starts_on: WeekStart::Sunday,
            default_reminder_time: "07:30".into(),
        };
        assert_eq!(update(&mut c, &next).unwrap(), next);
        assert_eq!(get(&c).unwrap(), next);
    }

    #[test]
    fn rejects_bad_times_and_ignores_corrupt_values() {
        let mut c = migrated_conn();
        for bad in ["9:00", "24:00", "12:60", "noon", ""] {
            let next = AppSettings {
                default_reminder_time: bad.into(),
                ..AppSettings::default()
            };
            assert!(update(&mut c, &next).is_err(), "{bad} must be rejected");
        }
        settings::set(&c, THEME, "\"purple\"").unwrap();
        assert_eq!(
            get(&c).unwrap().theme,
            ThemePreference::System,
            "unknown value → default"
        );
    }
}
