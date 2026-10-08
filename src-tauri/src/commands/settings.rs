use tauri::State;

use crate::commands::with_conn;
use crate::db::Db;
use crate::error::AppResult;
use crate::models::settings::AppSettings;
use crate::services::app_settings;

#[tauri::command]
pub fn get_settings(db: State<'_, Db>) -> AppResult<AppSettings> {
    with_conn(&db, |conn| app_settings::get(conn))
}

#[tauri::command]
pub fn update_settings(db: State<'_, Db>, settings: AppSettings) -> AppResult<AppSettings> {
    with_conn(&db, |conn| app_settings::update(conn, &settings))
}
