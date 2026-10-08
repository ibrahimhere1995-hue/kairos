use std::path::{Path, PathBuf};
use std::sync::Mutex;

use chrono::{SecondsFormat, Utc};

use crate::backup::{self, naming};
use crate::db::{self, Db};
use crate::error::AppResult;
use crate::models::backup::StartupNotice;
use crate::paths::{self, AppPaths};
use crate::services::{seed, trash};

/// Holds the repair notice until the frontend asks for it (`take_startup_notice`).
pub struct StartupNoticeState(pub Mutex<Option<StartupNotice>>);

/// ARCHITECTURE §6.1 (database part): integrity check (recovering from a backup if the file is
/// damaged) → open → migrate (backing up first) → seed defaults → clear expired Trash.
pub fn open_database(data_dir: &Path) -> AppResult<(Db, Option<StartupNotice>)> {
    std::fs::create_dir_all(data_dir)?;
    let paths = AppPaths::new(data_dir.to_path_buf());

    let notice = if paths.db_path.exists() && !backup::is_healthy(&paths.db_path) {
        Some(recover(&paths)?)
    } else {
        None
    };

    let mut conn = db::connection::open(&paths.db_path)?;
    db::migrations::migrate(&mut conn, &paths.backups_dir)?;
    seed::seed_defaults(&mut conn)?;
    trash::purge_expired(&mut conn, Utc::now(), &paths.backups_dir)?;
    Ok((Db(Mutex::new(conn)), notice))
}

/// Moves the damaged database (and its WAL/SHM files) aside, never deleting it, then puts the
/// newest backup that passes verification in its place.
fn recover(paths: &AppPaths) -> AppResult<StartupNotice> {
    let kept_dir = paths::corrupt_dir(&paths.data_dir);
    std::fs::create_dir_all(&kept_dir)?;
    let stamp = Utc::now().format("%Y%m%d-%H%M%S");
    let kept_at = kept_dir.join(format!("kairos-damaged-{stamp}.db"));
    for suffix in ["", "-wal", "-shm"] {
        let from = PathBuf::from(format!("{}{suffix}", paths.db_path.display()));
        if from.exists() {
            let to = PathBuf::from(format!("{}{suffix}", kept_at.display()));
            std::fs::rename(&from, &to).or_else(|_| std::fs::copy(&from, &to).map(|_| ()))?;
            let _ = std::fs::remove_file(&from);
        }
    }
    let kept_at = kept_at.display().to_string();

    let mut candidates: Vec<(PathBuf, naming::ParsedName)> = std::fs::read_dir(&paths.backups_dir)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter_map(|e| {
                    let path = e.path();
                    let parsed = naming::parse(path.file_name()?.to_str()?)?;
                    Some((path, parsed))
                })
                .collect()
        })
        .unwrap_or_default();
    candidates.sort_by_key(|c| std::cmp::Reverse(c.1.created_at));

    for (path, parsed) in candidates {
        if backup::verify(&path).is_ok() {
            std::fs::copy(&path, &paths.db_path)?;
            return Ok(StartupNotice::Restored {
                backup_created_at: parsed
                    .created_at
                    .to_rfc3339_opts(SecondsFormat::Millis, true),
                kept_at,
            });
        }
    }
    Ok(StartupNotice::Unrecoverable { kept_at })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::DB_FILE_NAME;
    use crate::db::test_support::scratch_path;
    use crate::repo::areas;

    fn add_item(db: &Db, title: &str) {
        let conn = db.0.lock().unwrap();
        conn.execute(
            "INSERT INTO items (id, kind, title, created_at, updated_at) VALUES (?1, 'task', ?1, 'now', 'now')",
            [title],
        )
        .unwrap();
    }

    fn titles(db: &Db) -> Vec<String> {
        let conn = db.0.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT title FROM items ORDER BY title")
            .unwrap();
        stmt.query_map([], |r| r.get(0))
            .unwrap()
            .map(Result::unwrap)
            .collect()
    }

    #[test]
    fn first_run_creates_the_database_file_with_defaults_and_reopens_cleanly() {
        let dir = scratch_path("startup");

        let (db, notice) = open_database(&dir).unwrap();
        assert!(notice.is_none());
        assert!(dir.join(DB_FILE_NAME).exists());
        assert_eq!(areas::active_names(&db.0.lock().unwrap()).unwrap().len(), 5);
        drop(db);

        // Second launch: healthy, no pending migrations → no backup, no duplicate areas.
        let (db, notice) = open_database(&dir).unwrap();
        assert!(notice.is_none());
        assert!(!paths::backups_dir(&dir).exists());
        assert_eq!(areas::active_names(&db.0.lock().unwrap()).unwrap().len(), 5);
        drop(db);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn damaged_database_is_kept_aside_and_the_latest_good_backup_restored() {
        let dir = scratch_path("recover");
        let (db, _) = open_database(&dir).unwrap();
        add_item(&db, "Before backup");
        let paths = AppPaths::new(dir.clone());
        crate::services::backups::backup_now(&db, &paths, naming::LABEL_AUTO).unwrap();
        // A later, broken backup must be skipped in favour of the good one.
        std::thread::sleep(std::time::Duration::from_millis(5));
        std::fs::write(
            paths
                .backups_dir
                .join(naming::file_name(naming::LABEL_AUTO, Utc::now())),
            b"broken",
        )
        .unwrap();
        drop(db);

        std::fs::write(dir.join(DB_FILE_NAME), b"this file got damaged").unwrap();

        let (db, notice) = open_database(&dir).unwrap();
        let Some(StartupNotice::Restored { kept_at, .. }) = notice else {
            panic!("expected a restored notice, got {notice:?}");
        };
        assert_eq!(titles(&db), ["Before backup"]);
        assert_eq!(
            std::fs::read(&kept_at).unwrap(),
            b"this file got damaged",
            "damaged file kept"
        );
        drop(db);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn with_no_good_backup_it_starts_fresh_and_still_keeps_the_damaged_file() {
        let dir = scratch_path("recover-none");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(DB_FILE_NAME), b"garbage").unwrap();

        let (db, notice) = open_database(&dir).unwrap();
        let Some(StartupNotice::Unrecoverable { kept_at }) = notice else {
            panic!("expected an unrecoverable notice, got {notice:?}");
        };
        assert!(Path::new(&kept_at).exists());
        assert_eq!(
            areas::active_names(&db.0.lock().unwrap()).unwrap().len(),
            5,
            "fresh, usable data"
        );
        drop(db);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
