use tauri::{AppHandle, Emitter, State};

use crate::backup::naming::LABEL_MANUAL;
use crate::commands::{ITEMS_CHANGED, with_conn};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::backup::{BackupInfo, BackupLocation, BackupSettings, StartupNotice};
use crate::paths::AppPaths;
use crate::services::backups;
use crate::startup::StartupNoticeState;

/// Event after a restore: every window reloads all of its data.
pub const DATA_RELOADED: &str = "data:reloaded";

#[tauri::command]
pub async fn list_backups(
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
) -> AppResult<Vec<BackupInfo>> {
    backups::list(&db, &paths)
}

#[tauri::command]
pub async fn backup_now(db: State<'_, Db>, paths: State<'_, AppPaths>) -> AppResult<BackupInfo> {
    backups::backup_now(&db, &paths, LABEL_MANUAL)
}

#[tauri::command]
pub async fn restore_backup(
    app: AppHandle,
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
    location: BackupLocation,
    file_name: String,
) -> AppResult<()> {
    backups::restore(&db, &paths, location, &file_name)?;
    // Best effort: windows also refetch on focus.
    let _ = app.emit(DATA_RELOADED, ());
    let _ = app.emit(ITEMS_CHANGED, ());
    Ok(())
}

#[tauri::command]
pub fn get_backup_settings(db: State<'_, Db>) -> AppResult<BackupSettings> {
    with_conn(&db, |conn| backups::get_settings(conn))
}

/// `folder`: an absolute path chosen with the system folder picker, or null to stop copying.
#[tauri::command]
pub fn set_backup_folder(db: State<'_, Db>, folder: Option<String>) -> AppResult<BackupSettings> {
    with_conn(&db, |conn| backups::set_folder(conn, folder.as_deref()))
}

/// Returns the startup repair notice once (then clears it).
#[tauri::command]
pub fn take_startup_notice(
    state: State<'_, StartupNoticeState>,
) -> AppResult<Option<StartupNotice>> {
    let mut notice = state.0.lock().map_err(|_| AppError::Lock)?;
    Ok(notice.take())
}
