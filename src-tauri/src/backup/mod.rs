//! Backup primitives (ARCHITECTURE §6.3). Scheduling, retention and restore live in
//! `services::backups`; this module only copies and verifies database files.

pub mod naming;
pub mod retention;

use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::Utc;
use rusqlite::backup::Backup;
use rusqlite::{Connection, OpenFlags};

use crate::error::{AppError, AppResult};

/// Copies a database into `dir` as `kairos-<label>-<UTC stamp>.db` using SQLite's Online Backup
/// API, which produces a consistent copy even while the database is being used.
pub fn backup_to_dir(conn: &Connection, dir: &Path, label: &str) -> AppResult<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let path = dir.join(naming::file_name(label, Utc::now()));

    let mut dest = Connection::open(&path)?;
    let backup = Backup::new(conn, &mut dest)?;
    backup.run_to_completion(256, Duration::from_millis(0), None)?;
    Ok(path)
}

/// Backs up the database file at `db_path` through its own read-only connection, so the app's
/// main connection stays free and the UI never waits for a backup.
pub fn backup_db_file(db_path: &Path, dir: &Path, label: &str) -> AppResult<PathBuf> {
    let source = open_read_only(db_path)?;
    backup_to_dir(&source, dir, label)
}

pub fn open_read_only(path: &Path) -> AppResult<Connection> {
    Ok(Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?)
}

/// True if SQLite's quick integrity check passes. Unreadable files count as damaged.
pub fn is_healthy(path: &Path) -> bool {
    let check = || -> rusqlite::Result<bool> {
        let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        let result: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
        Ok(result == "ok")
    };
    check().unwrap_or(false)
}

/// Opens a backup read-only, checks its integrity and counts the items in it.
pub fn verify(path: &Path) -> AppResult<i64> {
    if !is_healthy(path) {
        return Err(AppError::InvalidBackup);
    }
    let conn = open_read_only(path)?;
    let count = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE deleted_at IS NULL",
            [],
            |r| r.get(0),
        )
        .map_err(|_| AppError::InvalidBackup)?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::{migrated_conn, scratch_path};

    #[test]
    fn backup_contains_the_same_data_and_verifies() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO items (id, kind, title, created_at, updated_at) VALUES ('i1','task','Keep me','now','now')",
            [],
        )
        .unwrap();

        let dir = scratch_path("backup");
        let path = backup_to_dir(&conn, &dir, "test").unwrap();

        assert_eq!(verify(&path).unwrap(), 1);
        let copy = Connection::open(&path).unwrap();
        let title: String = copy
            .query_row("SELECT title FROM items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(title, "Keep me");

        drop(copy);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn damaged_files_fail_verification() {
        let dir = scratch_path("damaged");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("kairos-auto-20261008-101530.000.db");
        std::fs::write(&path, b"this is not a database").unwrap();
        assert!(!is_healthy(&path));
        assert!(matches!(verify(&path), Err(AppError::InvalidBackup)));
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
