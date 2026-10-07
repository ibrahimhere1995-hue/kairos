use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// Where Kairos keeps its database, backups and (later) attachments.
///
/// Development builds use `<project>/.devdata` so nothing lands on the system drive
/// (decision recorded in CLAUDE.md, 2026-10-07). Release builds use the OS app-data folder.
pub fn data_dir(app: &AppHandle) -> AppResult<PathBuf> {
    if cfg!(debug_assertions) {
        Ok(dev_data_dir())
    } else {
        app.path().app_data_dir().map_err(|_| AppError::DataDir)
    }
}

pub fn dev_data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(".devdata")
}

pub fn backups_dir(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("backups")
}
