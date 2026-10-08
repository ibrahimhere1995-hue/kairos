//! Tauri commands: thin wrappers that take the database lock and call a service.

pub mod areas;
pub mod backups;
pub mod items;
pub mod settings;
pub mod trash;

use rusqlite::Connection;
use tauri::{AppHandle, Emitter, Runtime};

use crate::db::Db;
use crate::error::{AppError, AppResult};

/// Event sent to every window after items change, so all views refresh
/// (e.g. the main window after an item is added from the Quick Capture window).
pub const ITEMS_CHANGED: &str = "items:changed";

pub(crate) fn with_conn<T>(
    db: &Db,
    f: impl FnOnce(&mut Connection) -> AppResult<T>,
) -> AppResult<T> {
    let mut conn = db.0.lock().map_err(|_| AppError::Lock)?;
    f(&mut conn)
}

/// Runs a write and, if it succeeded, tells every window that items changed.
pub(crate) fn write_items<R: Runtime, T>(
    app: &AppHandle<R>,
    db: &Db,
    f: impl FnOnce(&mut Connection) -> AppResult<T>,
) -> AppResult<T> {
    let result = with_conn(db, f)?;
    // Best effort: a missed refresh is harmless (views also refetch on focus).
    let _ = app.emit(ITEMS_CHANGED, ());
    Ok(result)
}
