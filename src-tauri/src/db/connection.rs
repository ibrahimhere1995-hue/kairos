use std::path::Path;
use std::time::Duration;

use rusqlite::Connection;

use crate::error::AppResult;

/// Opens (creating if needed) the database file and applies the required settings.
pub fn open(path: &Path) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    configure(&conn)?;
    Ok(conn)
}

/// ARCHITECTURE §5: WAL mode, foreign keys on, synchronous NORMAL.
pub fn configure(conn: &Connection) -> AppResult<()> {
    // journal_mode returns the resulting mode as a row, so it must be read back.
    let _mode: String =
        conn.pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get(0))?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.busy_timeout(Duration::from_secs(5))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_db_path(name: &str) -> std::path::PathBuf {
        let path = crate::db::test_support::scratch_path(name).with_extension("db");
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        path
    }

    #[test]
    fn file_database_uses_wal_foreign_keys_and_normal_sync() {
        let path = temp_db_path("pragmas");
        let conn = open(&path).unwrap();

        let mode: String = conn
            .query_row("PRAGMA journal_mode", [], |r| r.get(0))
            .unwrap();
        let fk: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap();
        let sync: i64 = conn
            .query_row("PRAGMA synchronous", [], |r| r.get(0))
            .unwrap();
        assert_eq!(mode.to_lowercase(), "wal");
        assert_eq!(fk, 1);
        assert_eq!(sync, 1, "1 = NORMAL");

        drop(conn);
        for suffix in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!("{}{suffix}", path.display()));
        }
    }
}
