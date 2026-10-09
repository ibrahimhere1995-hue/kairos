use std::path::PathBuf;

use tauri::{AppHandle, State};

use crate::backup::naming::LABEL_PRE_IMPORT;
use crate::commands::{with_conn, write_items};
use crate::db::Db;
use crate::error::AppResult;
use crate::paths::AppPaths;
use crate::services::backups;
use crate::services::portability::{self, ImportSummary};

/// Settings › Your data: everything as JSON, to a file the user chose.
#[tauri::command]
pub fn export_json(db: State<'_, Db>, path: String) -> AppResult<()> {
    with_conn(&db, |conn| {
        portability::export_json(conn, &PathBuf::from(&path))
    })
}

/// A calendar file of every dated task and event. Returns how many were written.
#[tauri::command]
pub fn export_ics(db: State<'_, Db>, path: String) -> AppResult<usize> {
    with_conn(&db, |conn| {
        portability::export_ics(conn, &PathBuf::from(&path))
    })
}

/// Imports a calendar file, after a "pre-import" backup (restorable in Settings › Backups).
#[tauri::command]
pub fn import_ics(
    app: AppHandle,
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
    path: String,
) -> AppResult<ImportSummary> {
    backups::backup_now(&db, &paths, LABEL_PRE_IMPORT)?;
    write_items(&app, &db, |conn| {
        portability::import_ics(conn, &PathBuf::from(&path))
    })
}
