//! Backup primitives. P1-T14 builds scheduled backups, retention and restore on top of this.

use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::Utc;
use rusqlite::Connection;
use rusqlite::backup::Backup;

use crate::error::AppResult;

/// Copies the live database into `dir` as `kairos-<label>-YYYYMMDD-HHmmss.db` using SQLite's
/// Online Backup API, which is safe while the database is in use (ARCHITECTURE §6.3).
pub fn backup_to_dir(conn: &Connection, dir: &Path, label: &str) -> AppResult<PathBuf> {
    std::fs::create_dir_all(dir)?;
    let stamp = Utc::now().format("%Y%m%d-%H%M%S%.3f");
    let path = dir.join(format!("kairos-{label}-{stamp}.db"));

    let mut dest = Connection::open(&path)?;
    let backup = Backup::new(conn, &mut dest)?;
    backup.run_to_completion(256, Duration::from_millis(0), None)?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;

    #[test]
    fn backup_contains_the_same_data() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('probe', '\"kept\"')",
            [],
        )
        .unwrap();

        let dir = crate::db::test_support::scratch_path("backup");
        let path = backup_to_dir(&conn, &dir, "test").unwrap();

        let copy = Connection::open(&path).unwrap();
        let value: String = copy
            .query_row("SELECT value FROM settings WHERE key = 'probe'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(value, "\"kept\"");

        drop(copy);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
