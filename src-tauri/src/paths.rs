use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};

/// Where Kairos keeps its database, backups and (later) attachments.
///
/// Development builds use `<project>/.devdata` so nothing lands on the system drive
/// (decision recorded in CLAUDE.md, 2026-10-07), or `KAIROS_DATA_DIR` when set (E2E tests).
/// Release builds always use the OS app-data folder.
pub fn data_dir(app: &AppHandle) -> AppResult<PathBuf> {
    if cfg!(debug_assertions) {
        // E2E tests point each run at a throwaway folder. Ignored in release builds.
        if let Some(dir) = std::env::var_os("KAIROS_DATA_DIR") {
            return Ok(PathBuf::from(dir));
        }
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

/// Damaged database files are moved here (never deleted) by startup recovery.
pub fn corrupt_dir(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("damaged")
}

/// Every file location Kairos uses, shared through Tauri state.
#[derive(Debug, Clone)]
pub struct AppPaths {
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub backups_dir: PathBuf,
}

impl AppPaths {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            db_path: data_dir.join(crate::db::DB_FILE_NAME),
            backups_dir: backups_dir(&data_dir),
            data_dir,
        }
    }
}
