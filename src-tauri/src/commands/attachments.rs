use std::path::PathBuf;

use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::commands::{with_conn, write_items};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::attachment::Attachment;
use crate::paths::AppPaths;
use crate::services::attachments;

#[tauri::command]
pub fn list_attachments(db: State<'_, Db>, item_id: String) -> AppResult<Vec<Attachment>> {
    with_conn(&db, |conn| attachments::list(conn, &item_id))
}

/// Copies the chosen files (from the system file picker) onto the item.
#[tauri::command]
pub fn add_attachments(
    app: AppHandle,
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
    item_id: String,
    files: Vec<String>,
) -> AppResult<Vec<Attachment>> {
    write_items(&app, &db, |conn| {
        let tx = conn.transaction()?;
        let mut added = Vec::with_capacity(files.len());
        for file in &files {
            added.push(attachments::add(
                &tx,
                &paths.attachments_dir,
                &item_id,
                &PathBuf::from(file),
            )?);
        }
        tx.commit()?;
        Ok(added)
    })
}

#[tauri::command]
pub fn remove_attachment(app: AppHandle, db: State<'_, Db>, id: String) -> AppResult<()> {
    write_items(&app, &db, |conn| attachments::remove(conn, &id))
}

/// Opens the file in the system's usual app for it. Only Kairos' own attachment files can be
/// opened this way.
#[tauri::command]
pub fn open_attachment(
    app: AppHandle,
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
    id: String,
) -> AppResult<()> {
    let path = with_conn(&db, |conn| {
        attachments::file_of(conn, &paths.attachments_dir, &id)
    })?;
    app.opener()
        .open_path(path.display().to_string(), None::<&str>)
        .map_err(|_| AppError::invalid("attachments", "openFailed"))
}

/// Shows the file in Explorer / Finder.
#[tauri::command]
pub fn reveal_attachment(
    app: AppHandle,
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
    id: String,
) -> AppResult<()> {
    let path = with_conn(&db, |conn| {
        attachments::file_of(conn, &paths.attachments_dir, &id)
    })?;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|_| AppError::invalid("attachments", "openFailed"))
}
