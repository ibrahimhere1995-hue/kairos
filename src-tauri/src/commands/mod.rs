//! Tauri commands: thin wrappers that take the database lock and call a service.

pub mod items;

use rusqlite::Connection;

use crate::db::Db;
use crate::error::{AppError, AppResult};

pub(crate) fn with_conn<T>(
    db: &Db,
    f: impl FnOnce(&mut Connection) -> AppResult<T>,
) -> AppResult<T> {
    let mut conn = db.0.lock().map_err(|_| AppError::Lock)?;
    f(&mut conn)
}
