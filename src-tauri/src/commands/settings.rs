use tauri::{AppHandle, State};

use crate::autostart;
use crate::commands::with_conn;
use crate::db::Db;
use crate::error::AppResult;
use crate::models::settings::AppSettings;
use crate::services::{app_settings, reminders};

#[tauri::command]
pub fn get_settings(db: State<'_, Db>) -> AppResult<AppSettings> {
    with_conn(&db, |conn| app_settings::get(conn))
}

#[tauri::command]
pub fn update_settings(
    app: AppHandle,
    db: State<'_, Db>,
    settings: AppSettings,
) -> AppResult<AppSettings> {
    let (before, saved) = with_conn(&db, |conn| {
        let before = app_settings::get(conn)?;
        let saved = app_settings::update(conn, &settings)?;
        // All-day reminders move to the new default time.
        if saved.default_reminder_time != before.default_reminder_time {
            let clock = reminders::Clock::current(conn)?;
            reminders::recompute_waiting(conn, &clock)?;
        }
        Ok((before, saved))
    })?;
    if saved.launch_at_login != before.launch_at_login {
        autostart::apply(&app, saved.launch_at_login);
    }
    Ok(saved)
}
