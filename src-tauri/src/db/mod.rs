pub mod connection;
pub mod migrations;

use std::sync::Mutex;

use rusqlite::Connection;

/// The single app-wide connection, shared through Tauri state.
/// One user on one machine: a mutex-guarded connection is enough (WAL keeps reads fast).
pub struct Db(pub Mutex<Connection>);

pub const DB_FILE_NAME: &str = "kairos.db";

#[cfg(test)]
pub mod test_support {
    use std::path::PathBuf;

    use rusqlite::Connection;

    /// Unique scratch path inside the build folder (never the system temp dir on C:).
    pub fn scratch_path(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("test-scratch")
            .join(format!("{name}-{}", crate::util::new_id()))
    }

    /// Fresh in-memory database with the full schema applied.
    pub fn migrated_conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        super::connection::configure(&conn).unwrap();
        super::migrations::MIGRATIONS.to_latest(&mut conn).unwrap();
        conn
    }
}
