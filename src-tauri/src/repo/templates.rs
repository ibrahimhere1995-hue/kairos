use rusqlite::{Connection, params};

/// `(id, name, payload JSON, created_at)` of templates not deleted, newest first.
pub fn list(conn: &Connection) -> rusqlite::Result<Vec<(String, String, String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, payload, created_at FROM templates WHERE deleted_at IS NULL
         ORDER BY created_at DESC, id DESC",
    )?;
    stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?
        .collect()
}

pub fn get_payload(conn: &Connection, id: &str) -> rusqlite::Result<Option<String>> {
    use rusqlite::OptionalExtension;
    conn.query_row(
        "SELECT payload FROM templates WHERE id = ?1 AND deleted_at IS NULL",
        [id],
        |r| r.get(0),
    )
    .optional()
}

pub fn insert(
    conn: &Connection,
    id: &str,
    name: &str,
    payload: &str,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO templates (id, name, payload, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, name, payload, now],
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
        "UPDATE templates SET deleted_at = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, deleted_at, now],
    )
}
