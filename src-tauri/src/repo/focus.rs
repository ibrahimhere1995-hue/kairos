use rusqlite::{Connection, params};

use crate::models::focus::FocusSession;

pub fn insert(conn: &Connection, s: &FocusSession, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO focus_sessions (id, item_id, started_at, planned_minutes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![s.id, s.item_id, s.started_at, s.planned_minutes, now],
    )?;
    Ok(())
}

/// Ends a session that is still open; a finished one is left as it is.
pub fn end(conn: &Connection, id: &str, ended_at: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE focus_sessions SET ended_at = ?2, updated_at = ?2
         WHERE id = ?1 AND ended_at IS NULL",
        params![id, ended_at],
    )?;
    Ok(())
}

/// Sessions never ended (the app was closed mid-focus): `(id, started_at, planned_minutes)`.
pub fn list_open(conn: &Connection) -> rusqlite::Result<Vec<(String, String, i64)>> {
    let mut stmt = conn.prepare(
        "SELECT id, started_at, planned_minutes FROM focus_sessions
         WHERE ended_at IS NULL AND deleted_at IS NULL",
    )?;
    stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect()
}

/// Finished sessions started in `[start, end)`, with their task's area:
/// `(area_id, started_at, ended_at)`.
pub fn finished_between(
    conn: &Connection,
    start: &str,
    end: &str,
) -> rusqlite::Result<Vec<(Option<String>, String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT i.area_id, f.started_at, f.ended_at FROM focus_sessions f
         LEFT JOIN items i ON i.id = f.item_id
         WHERE f.deleted_at IS NULL AND f.ended_at IS NOT NULL
           AND f.started_at >= ?1 AND f.started_at < ?2",
    )?;
    stmt.query_map(params![start, end], |r| {
        Ok((r.get(0)?, r.get(1)?, r.get(2)?))
    })?
    .collect()
}
