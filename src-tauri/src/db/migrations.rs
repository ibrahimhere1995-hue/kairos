use std::path::{Path, PathBuf};

use rusqlite::Connection;
use rusqlite_migration::{M, Migrations, SchemaVersion};

use crate::backup;
use crate::error::AppResult;

/// Ordered list of schema migrations. Append only; never edit one that has shipped.
const MIGRATION_LIST: &[M<'static>] = &[
    M::up(include_str!("migrations/0001_initial.sql")),
    M::up(include_str!("migrations/0002_checklist_search.sql")),
    M::up(include_str!("migrations/0003_attachments.sql")),
];

pub const MIGRATIONS: Migrations<'static> = Migrations::from_slice(MIGRATION_LIST);

/// Brings the schema up to date. If an existing database has pending migrations it is
/// backed up first (PROJECT_RULES #1); returns the backup path when one was made.
pub fn migrate(conn: &mut Connection, backups_dir: &Path) -> AppResult<Option<PathBuf>> {
    migrate_with(&MIGRATIONS, conn, backups_dir)
}

fn migrate_with(
    migrations: &Migrations,
    conn: &mut Connection,
    backups_dir: &Path,
) -> AppResult<Option<PathBuf>> {
    let pending = migrations.pending_migrations(conn)?;
    let has_existing_schema = !matches!(migrations.current_version(conn)?, SchemaVersion::NoneSet);

    let backup_path = if pending > 0 && has_existing_schema {
        Some(backup::backup_to_dir(conn, backups_dir, "pre-migration")?)
    } else {
        None
    };

    migrations.to_latest(conn)?;
    Ok(backup_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;

    #[test]
    fn migrations_are_valid() {
        MIGRATIONS.validate().unwrap();
    }

    #[test]
    fn creates_every_phase_one_table() {
        let conn = migrated_conn();
        for table in [
            "areas",
            "goals",
            "milestones",
            "items",
            "checklist_items",
            "reminders",
            "settings",
            "backup_log",
            "items_fts",
            "checklist_fts",
            "attachments",
        ] {
            let exists: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name = ?1)",
                    [table],
                    |r| r.get(0),
                )
                .unwrap();
            assert!(exists, "missing table {table}");
        }
    }

    #[test]
    fn foreign_keys_are_enforced() {
        let conn = migrated_conn();
        let result = conn.execute(
            "INSERT INTO checklist_items (id, item_id, text, sort_order, created_at, updated_at)
             VALUES ('c1', 'no-such-item', 'x', 0, 'now', 'now')",
            [],
        );
        assert!(result.is_err(), "orphan checklist item must be rejected");
    }

    #[test]
    fn item_kind_is_restricted() {
        let conn = migrated_conn();
        let result = conn.execute(
            "INSERT INTO items (id, kind, title, created_at, updated_at)
             VALUES ('i1', 'note', 't', 'now', 'now')",
            [],
        );
        assert!(result.is_err());
    }

    fn insert_item(conn: &Connection, id: &str, title: &str, notes: &str) {
        conn.execute(
            "INSERT INTO items (id, kind, title, notes, created_at, updated_at)
             VALUES (?1, 'task', ?2, ?3, 'now', 'now')",
            [id, title, notes],
        )
        .unwrap();
    }

    fn search(conn: &Connection, query: &str) -> Vec<String> {
        let mut stmt = conn
            .prepare(
                "SELECT items.id FROM items_fts JOIN items ON items.rowid = items_fts.rowid
                 WHERE items_fts MATCH ?1 ORDER BY items.id",
            )
            .unwrap();
        stmt.query_map([query], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap()
    }

    #[test]
    fn search_index_follows_inserts_updates_and_deletes() {
        let conn = migrated_conn();
        insert_item(&conn, "a", "Call bank", "about the loan");
        insert_item(&conn, "b", "Gym", "leg day");

        assert_eq!(search(&conn, "bank"), ["a"]);
        assert_eq!(search(&conn, "loan"), ["a"], "notes are searchable");

        conn.execute("UPDATE items SET title = 'Call dentist' WHERE id = 'a'", [])
            .unwrap();
        assert!(search(&conn, "bank").is_empty(), "old title removed");
        assert_eq!(search(&conn, "dentist"), ["a"]);

        conn.execute("DELETE FROM items WHERE id = 'b'", [])
            .unwrap();
        assert!(search(&conn, "gym").is_empty());
    }

    #[test]
    fn fresh_database_is_not_backed_up() {
        let mut conn = Connection::open_in_memory().unwrap();
        let dir = crate::db::test_support::scratch_path("mig");
        let backup = migrate(&mut conn, &dir).unwrap();
        assert!(backup.is_none());
        assert!(!dir.exists());
    }

    #[test]
    fn existing_database_is_backed_up_before_a_new_migration() {
        let mut conn = migrated_conn();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('probe', '1')",
            [],
        )
        .unwrap();

        // Simulate a future release that adds one more migration.
        let future = [
            M::up(include_str!("migrations/0001_initial.sql")),
            M::up(include_str!("migrations/0002_checklist_search.sql")),
            M::up(include_str!("migrations/0003_attachments.sql")),
            M::up("ALTER TABLE areas ADD COLUMN future_column TEXT;"),
        ];
        let dir = crate::db::test_support::scratch_path("mig");
        let backup = migrate_with(&Migrations::from_slice(&future), &mut conn, &dir)
            .unwrap()
            .expect("a backup must be made before migrating existing data");

        let copy = Connection::open(&backup).unwrap();
        let probe: String = copy
            .query_row("SELECT value FROM settings WHERE key = 'probe'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(probe, "1", "backup holds the pre-migration data");
        let has_future_column: bool = copy
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM pragma_table_info('areas') WHERE name = 'future_column')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(
            !has_future_column,
            "backup is taken before the migration runs"
        );

        drop(copy);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn up_to_date_database_is_not_backed_up_again() {
        let mut conn = migrated_conn();
        let dir = crate::db::test_support::scratch_path("mig");
        assert!(migrate(&mut conn, &dir).unwrap().is_none());
    }
}
