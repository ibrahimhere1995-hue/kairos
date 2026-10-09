use rusqlite::{Connection, OptionalExtension, params};

use crate::models::attachment::Attachment;

const COLUMNS: &str = "id, item_id, file_name, mime, size_bytes, created_at";

fn from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Attachment> {
    Ok(Attachment {
        id: row.get(0)?,
        item_id: row.get(1)?,
        file_name: row.get(2)?,
        mime: row.get(3)?,
        size_bytes: row.get(4)?,
        created_at: row.get(5)?,
    })
}

/// An item's attachments that aren't removed, oldest first.
pub fn list_for_item(conn: &Connection, item_id: &str) -> rusqlite::Result<Vec<Attachment>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM attachments WHERE item_id = ?1 AND deleted_at IS NULL
         ORDER BY created_at, id"
    ))?;
    stmt.query_map([item_id], from_row)?.collect()
}

/// An attachment that isn't removed, with the file's name inside the attachments folder.
pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<(Attachment, String)>> {
    conn.query_row(
        &format!(
            "SELECT {COLUMNS}, rel_path FROM attachments WHERE id = ?1 AND deleted_at IS NULL"
        ),
        [id],
        |row| Ok((from_row(row)?, row.get(6)?)),
    )
    .optional()
}

pub fn insert(conn: &Connection, a: &Attachment, rel_path: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO attachments (id, item_id, file_name, mime, size_bytes, rel_path, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![a.id, a.item_id, a.file_name, a.mime, a.size_bytes, rel_path, a.created_at],
    )?;
    Ok(())
}

pub fn soft_delete(conn: &Connection, id: &str, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE attachments SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, now],
    )
}

pub fn count_for_item(conn: &Connection, item_id: &str) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM attachments WHERE item_id = ?1 AND deleted_at IS NULL",
        [item_id],
        |r| r.get(0),
    )
}

/// Every attachment file name the database refers to (removed ones too: they can come back).
pub fn all_rel_paths(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT rel_path FROM attachments")?;
    stmt.query_map([], |r| r.get(0))?.collect()
}
