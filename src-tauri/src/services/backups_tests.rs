use super::*;
use crate::backup::naming::{LABEL_AUTO, LABEL_MANUAL};
use crate::db::test_support::scratch_path;
use crate::startup::open_database;

struct Fixture {
    dir: PathBuf,
    db: Db,
    paths: AppPaths,
}

impl Fixture {
    fn new(name: &str) -> Self {
        let dir = scratch_path(name);
        let (db, _) = open_database(&dir).unwrap();
        let paths = AppPaths::new(dir.clone());
        Self { dir, db, paths }
    }

    fn add_item(&self, title: &str) {
        let conn = self.db.0.lock().unwrap();
        conn.execute(
            "INSERT INTO items (id, kind, title, created_at, updated_at) VALUES (?1, 'task', ?1, 'now', 'now')",
            [title],
        )
        .unwrap();
    }

    fn titles(&self) -> Vec<String> {
        let conn = self.db.0.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT title FROM items WHERE deleted_at IS NULL ORDER BY title")
            .unwrap();
        stmt.query_map([], |r| r.get(0))
            .unwrap()
            .map(Result::unwrap)
            .collect()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

#[test]
fn back_up_now_verifies_logs_and_lists() {
    let f = Fixture::new("bk-now");
    f.add_item("One");
    f.add_item("Two");

    let info = backup_now(&f.db, &f.paths, LABEL_MANUAL).unwrap();
    assert_eq!(info.kind, BackupKind::Manual);
    assert_eq!(info.item_count, Some(2));
    assert!(info.size_bytes > 0);

    let listed = list(&f.db, &f.paths).unwrap();
    assert_eq!(listed, [info]);
    let s = get_settings(&f.db.0.lock().unwrap()).unwrap();
    assert!(s.last_backup_at.is_some());
    assert!(s.last_failure_at.is_none());
}

/// P1-T14 acceptance (E2E at the service level): create items → backup → delete → restore → back.
#[test]
fn restore_brings_deleted_items_back_and_saves_current_data_first() {
    let f = Fixture::new("bk-restore");
    f.add_item("Call bank");
    f.add_item("Gym");
    let backup = backup_now(&f.db, &f.paths, LABEL_MANUAL).unwrap();

    f.db.0
        .lock()
        .unwrap()
        .execute("DELETE FROM items", [])
        .unwrap();
    f.add_item("Added after backup");
    assert_eq!(f.titles(), ["Added after backup"]);

    restore(&f.db, &f.paths, BackupLocation::App, &backup.file_name).unwrap();
    assert_eq!(f.titles(), ["Call bank", "Gym"]);

    // The data from just before the restore was saved as a safety copy.
    let safety: Vec<BackupInfo> = list(&f.db, &f.paths)
        .unwrap()
        .into_iter()
        .filter(|b| b.kind == BackupKind::Safety)
        .collect();
    assert_eq!(safety.len(), 1);
    assert_eq!(safety[0].item_count, Some(1));
}

#[test]
fn restore_rejects_bad_names_missing_files_and_damaged_backups() {
    let f = Fixture::new("bk-reject");
    for bad in ["../kairos.db", "kairos.db", "C:\\Windows\\win.ini"] {
        assert!(matches!(
            restore(&f.db, &f.paths, BackupLocation::App, bad),
            Err(AppError::InvalidBackup)
        ));
    }
    let missing = naming::file_name(LABEL_AUTO, Utc::now());
    assert!(matches!(
        restore(&f.db, &f.paths, BackupLocation::App, &missing),
        Err(AppError::NotFound)
    ));

    std::fs::create_dir_all(&f.paths.backups_dir).unwrap();
    std::fs::write(f.paths.backups_dir.join(&missing), b"damaged").unwrap();
    assert!(matches!(
        restore(&f.db, &f.paths, BackupLocation::App, &missing),
        Err(AppError::InvalidBackup)
    ));
}

#[test]
fn extra_folder_gets_a_copy_and_its_backups_are_listed() {
    let f = Fixture::new("bk-folder");
    let folder = f.dir.join("OneDrive").join("Kairos");
    let s = set_folder(&f.db.0.lock().unwrap(), Some(&folder.display().to_string())).unwrap();
    assert_eq!(
        s.folder.as_deref(),
        Some(folder.display().to_string().as_str())
    );

    let info = backup_now(&f.db, &f.paths, LABEL_MANUAL).unwrap();
    assert!(
        folder.join(&info.file_name).is_file(),
        "copied to the extra folder"
    );

    let listed = list(&f.db, &f.paths).unwrap();
    assert_eq!(listed.len(), 2);
    assert!(listed.iter().any(|b| b.location == BackupLocation::Folder));

    // Restoring from the extra folder works too (e.g. on a new laptop).
    restore(&f.db, &f.paths, BackupLocation::Folder, &info.file_name).unwrap();
}

#[test]
fn folder_must_be_absolute_and_can_be_cleared() {
    let f = Fixture::new("bk-folder-rules");
    let conn = f.db.0.lock().unwrap();
    assert!(matches!(
        set_folder(&conn, Some("relative/path")),
        Err(AppError::Validation {
            reason: "folderNotAbsolute",
            ..
        })
    ));
    assert!(set_folder(&conn, None).unwrap().folder.is_none());
}

#[test]
fn failed_backups_are_logged_for_the_settings_screen() {
    let f = Fixture::new("bk-fail");
    // Point the database path somewhere unreadable to simulate a failure.
    let broken = AppPaths {
        db_path: f.dir.join("missing").join("kairos.db"),
        ..f.paths.clone()
    };
    assert!(backup_now(&f.db, &broken, LABEL_AUTO).is_err());
    let s = get_settings(&f.db.0.lock().unwrap()).unwrap();
    assert!(s.last_failure_at.is_some());

    backup_now(&f.db, &f.paths, LABEL_AUTO).unwrap();
    assert!(
        get_settings(&f.db.0.lock().unwrap())
            .unwrap()
            .last_failure_at
            .is_none(),
        "cleared by a success"
    );
}

#[test]
fn automatic_backups_are_due_every_24_hours() {
    let f = Fixture::new("bk-due");
    let now = Utc::now();
    assert!(
        is_auto_due(&f.db.0.lock().unwrap(), now).unwrap(),
        "never backed up"
    );
    backup_now(&f.db, &f.paths, LABEL_AUTO).unwrap();
    let conn = f.db.0.lock().unwrap();
    assert!(!is_auto_due(&conn, Utc::now()).unwrap());
    assert!(is_auto_due(&conn, Utc::now() + chrono::Duration::hours(25)).unwrap());
}

#[test]
fn retention_removes_old_automatic_backups_but_never_manual_ones() {
    let f = Fixture::new("bk-retention");
    std::fs::create_dir_all(&f.paths.backups_dir).unwrap();
    let source = backup_now(&f.db, &f.paths, LABEL_MANUAL).unwrap();
    let source_path = f.paths.backups_dir.join(&source.file_name);
    for days in 0..40 {
        let at = Utc::now() - chrono::Duration::days(days);
        for label in [LABEL_AUTO, LABEL_MANUAL] {
            std::fs::copy(
                &source_path,
                f.paths.backups_dir.join(naming::file_name(label, at)),
            )
            .unwrap();
        }
    }
    apply_retention(&f.paths.backups_dir);
    let left = backups_in(&f.paths.backups_dir);
    let autos = left.iter().filter(|(_, p)| p.label == LABEL_AUTO).count();
    let manuals = left.iter().filter(|(_, p)| p.label == LABEL_MANUAL).count();
    assert!(
        autos <= retention::DAILY_KEEP + retention::WEEKLY_KEEP,
        "{autos} automatic kept"
    );
    assert_eq!(manuals, 41, "manual backups are never removed");
}
