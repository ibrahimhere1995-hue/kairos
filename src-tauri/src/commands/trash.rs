use tauri::{AppHandle, State};

use crate::commands::{with_conn, write_items};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::item::Item;
use crate::paths::AppPaths;
use crate::services::trash;

#[tauri::command]
pub fn list_trash(db: State<'_, Db>) -> AppResult<Vec<Item>> {
    with_conn(&db, |conn| trash::list(conn))
}

/// Backs up, then permanently removes everything in the Trash. Returns how many items.
#[tauri::command]
pub async fn empty_trash(
    app: AppHandle,
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
) -> AppResult<usize> {
    write_items(&app, &db, |conn| trash::empty(conn, &paths.backups_dir))
}
