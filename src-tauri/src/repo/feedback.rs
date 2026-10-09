use rusqlite::{Connection, OptionalExtension, params};

use crate::models::feedback::Feedback;

const COLUMNS: &str = "id, kind, text, context, status, created_at";

fn from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Feedback> {
    Ok(Feedback {
        id: row.get(0)?,
        kind: row.get(1)?,
        text: row.get(2)?,
        context: row.get(3)?,
        status: row.get(4)?,
        created_at: row.get(5)?,
    })
}

/// Newest first.
pub fn list_active(conn: &Connection) -> rusqlite::Result<Vec<Feedback>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM feedback WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC"
    ))?;
    stmt.query_map([], from_row)?.collect()
}

/// Including deleted ones (for restore).
pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<(Feedback, bool)>> {
    conn.query_row(
        &format!("SELECT {COLUMNS}, deleted_at IS NOT NULL FROM feedback WHERE id = ?1"),
        [id],
        |r| Ok((from_row(r)?, r.get(6)?)),
    )
    .optional()
}

pub fn insert(conn: &Connection, f: &Feedback) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO feedback (id, kind, text, context, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![f.id, f.kind, f.text, f.context, f.status, f.created_at],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, f: &Feedback, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE feedback SET kind = ?2, text = ?3, context = ?4, status = ?5, updated_at = ?6
         WHERE id = ?1",
        params![f.id, f.kind, f.text, f.context, f.status, now],
    )?;
    Ok(())
}

pub fn set_deleted(
    conn: &Connection,
    id: &str,
    deleted_at: Option<&str>,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE feedback SET deleted_at = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, deleted_at, now],
    )?;
    Ok(())
}
