//! Trash (PRD R1): deleted items stay restorable for 30 days, then are removed for good.
//! Anything removed for good is backed up first (PROJECT_RULES #1).

use std::path::Path;

use chrono::{DateTime, Duration, SecondsFormat, Utc};
use rusqlite::Connection;

use crate::backup::{self, naming::LABEL_PRE_PURGE};
use crate::error::AppResult;
use crate::models::item::Item;
use crate::repo::items as repo;

pub const TRASH_DAYS: i64 = 30;

pub fn list(conn: &Connection) -> AppResult<Vec<Item>> {
    Ok(repo::list_deleted(conn)?)
}

/// Backs up, then permanently removes Trash items deleted before `cutoff` (all if None).
/// Returns how many were removed.
fn purge(conn: &mut Connection, cutoff: Option<&str>, backups_dir: &Path) -> AppResult<usize> {
    if repo::count_deleted(conn, cutoff)? == 0 {
        return Ok(0);
    }
    backup::backup_to_dir(conn, backups_dir, LABEL_PRE_PURGE)?;
    let tx = conn.transaction()?;
    let removed = repo::purge_deleted(&tx, cutoff)?;
    tx.commit()?;
    Ok(removed)
}

/// "Empty Trash" (the UI asks for confirmation first).
pub fn empty(conn: &mut Connection, backups_dir: &Path) -> AppResult<usize> {
    purge(conn, None, backups_dir)
}

/// Runs at startup: removes items that have been in the Trash for more than 30 days.
pub fn purge_expired(
    conn: &mut Connection,
    now: DateTime<Utc>,
    backups_dir: &Path,
) -> AppResult<usize> {
    let cutoff = (now - Duration::days(TRASH_DAYS)).to_rfc3339_opts(SecondsFormat::Millis, true);
    purge(conn, Some(&cutoff), backups_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::{migrated_conn, scratch_path};
    use crate::models::checklist::ChecklistEntryInput;
    use crate::models::inputs::ItemInput;
    use crate::models::item::ItemKind;
    use crate::services::{checklist, items};

    fn add(conn: &mut Connection, title: &str) -> String {
        items::create(
            conn,
            &ItemInput {
                kind: ItemKind::Task,
                title: title.into(),
                notes: None,
                area_id: None,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: None,
                location: None,
                source: None,
                reminders: None,
                rrule: None,
                milestone_id: None,
            },
        )
        .unwrap()
        .id
    }

    fn set_deleted_at(conn: &Connection, id: &str, when: &str) {
        conn.execute("UPDATE items SET deleted_at = ?2 WHERE id = ?1", [id, when])
            .unwrap();
    }

    fn backups_in(dir: &Path) -> usize {
        std::fs::read_dir(dir).map(|d| d.count()).unwrap_or(0)
    }

    #[test]
    fn lists_only_deleted_items_newest_first() {
        let mut c = migrated_conn();
        let a = add(&mut c, "Old");
        let b = add(&mut c, "Recent");
        add(&mut c, "Kept");
        set_deleted_at(&c, &a, "2026-10-01T00:00:00.000Z");
        set_deleted_at(&c, &b, "2026-10-07T00:00:00.000Z");
        let titles: Vec<String> = list(&c).unwrap().into_iter().map(|i| i.title).collect();
        assert_eq!(titles, ["Recent", "Old"]);
    }

    #[test]
    fn emptying_backs_up_first_and_removes_steps_too() {
        let mut c = migrated_conn();
        let gone = add(&mut c, "Gone");
        let kept = add(&mut c, "Kept");
        checklist::set_checklist(
            &mut c,
            &gone,
            &[ChecklistEntryInput {
                id: None,
                text: "step".into(),
                done: false,
            }],
        )
        .unwrap();
        items::delete(&mut c, &gone).unwrap();

        let dir = scratch_path("trash-empty");
        assert_eq!(empty(&mut c, &dir).unwrap(), 1);
        assert_eq!(backups_in(&dir), 1, "a pre-purge backup was made");

        let left: i64 = c
            .query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(left, 1);
        assert!(repo::get(&c, &kept).unwrap().is_some());
        let steps: i64 = c
            .query_row("SELECT COUNT(*) FROM checklist_items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(steps, 0, "orphan steps removed");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn empty_trash_with_nothing_in_it_makes_no_backup() {
        let mut c = migrated_conn();
        let dir = scratch_path("trash-none");
        assert_eq!(empty(&mut c, &dir).unwrap(), 0);
        assert_eq!(backups_in(&dir), 0);
    }

    #[test]
    fn purges_only_items_older_than_30_days() {
        let mut c = migrated_conn();
        let old = add(&mut c, "31 days");
        let young = add(&mut c, "29 days");
        set_deleted_at(&c, &old, "2026-09-07T00:00:00.000Z");
        set_deleted_at(&c, &young, "2026-09-09T00:00:00.000Z");
        let now = DateTime::parse_from_rfc3339("2026-10-08T00:00:00Z")
            .unwrap()
            .to_utc();

        let dir = scratch_path("trash-expire");
        assert_eq!(purge_expired(&mut c, now, &dir).unwrap(), 1);
        assert!(repo::get(&c, &old).unwrap().is_none());
        assert!(repo::get(&c, &young).unwrap().is_some(), "still restorable");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
