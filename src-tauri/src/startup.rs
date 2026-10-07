use std::path::Path;
use std::sync::Mutex;

use crate::db::{self, DB_FILE_NAME, Db};
use crate::error::AppResult;
use crate::paths;
use crate::services::seed;

/// ARCHITECTURE §6.1 (database part): open → migrate (backing up first) → seed defaults.
/// The integrity check and automatic recovery are added in P1-T15.
pub fn open_database(data_dir: &Path) -> AppResult<Db> {
    std::fs::create_dir_all(data_dir)?;
    let mut conn = db::connection::open(&data_dir.join(DB_FILE_NAME))?;
    db::migrations::migrate(&mut conn, &paths::backups_dir(data_dir))?;
    seed::seed_defaults(&mut conn)?;
    Ok(Db(Mutex::new(conn)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repo::areas;

    #[test]
    fn first_run_creates_the_database_file_with_defaults_and_reopens_cleanly() {
        let dir = crate::db::test_support::scratch_path("startup");

        let db = open_database(&dir).unwrap();
        assert!(dir.join(DB_FILE_NAME).exists());
        {
            let conn = db.0.lock().unwrap();
            assert_eq!(areas::active_names(&conn).unwrap().len(), 5);
        }
        drop(db);

        // Second launch: no pending migrations → no backup, no duplicate areas.
        let db = open_database(&dir).unwrap();
        assert!(!paths::backups_dir(&dir).exists());
        {
            let conn = db.0.lock().unwrap();
            assert_eq!(areas::active_names(&conn).unwrap().len(), 5);
        }
        drop(db);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
