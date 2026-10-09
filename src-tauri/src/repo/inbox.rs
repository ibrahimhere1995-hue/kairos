use rusqlite::{Connection, OptionalExtension, params};

use crate::services::inbox::InboxEntry;

pub fn insert(conn: &Connection, e: &InboxEntry, image_path: Option<&str>) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO inbox_entries (id, kind, text, image_path, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![
            e.id,
            if e.has_image { "image" } else { "text" },
            e.text,
            image_path,
            e.created_at
        ],
    )?;
    Ok(())
}

/// Entries still waiting to be dealt with, newest first.
pub fn list_pending(conn: &Connection) -> rusqlite::Result<Vec<InboxEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, text, image_path IS NOT NULL, created_at FROM inbox_entries
         WHERE deleted_at IS NULL AND processed_item_id IS NULL ORDER BY created_at DESC, id DESC",
    )?;
    stmt.query_map([], |r| {
        Ok(InboxEntry {
            id: r.get(0)?,
            text: r.get(1)?,
            has_image: r.get(2)?,
            created_at: r.get(3)?,
        })
    })?
    .collect()
}

/// `(text, image_path)` of an entry not deleted; `pending_only` also requires it unprocessed.
pub fn content(
    conn: &Connection,
    id: &str,
    pending_only: bool,
) -> rusqlite::Result<Option<(Option<String>, Option<String>)>> {
    conn.query_row(
        "SELECT text, image_path FROM inbox_entries
         WHERE id = ?1 AND deleted_at IS NULL AND (?2 = 0 OR processed_item_id IS NULL)",
        params![id, pending_only],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .optional()
}

pub fn mark_processed(
    conn: &Connection,
    id: &str,
    item_id: &str,
    attachment_id: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE inbox_entries SET processed_item_id = ?2, attachment_id = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, item_id, attachment_id, now],
    )?;
    Ok(())
}

pub fn set_deleted(
    conn: &Connection,
    id: &str,
    deleted_at: Option<&str>,
    now: &str,
) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE inbox_entries SET deleted_at = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, deleted_at, now],
    )
}
