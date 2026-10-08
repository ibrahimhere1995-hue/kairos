use rusqlite::{Connection, OptionalExtension, params};

pub struct LogEntry<'a> {
    pub id: &'a str,
    pub path: &'a str,
    pub kind: &'a str,
    pub size_bytes: Option<i64>,
    pub item_count: Option<i64>,
    pub ok: bool,
    pub error: Option<&'a str>,
    pub created_at: &'a str,
}

pub fn insert(conn: &Connection, e: &LogEntry) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO backup_log (id, path, kind, size_bytes, item_count, ok, error, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            e.id,
            e.path,
            e.kind,
            e.size_bytes,
            e.item_count,
            e.ok,
            e.error,
            e.created_at
        ],
    )?;
    Ok(())
}

/// Time of the most recent successful / failed backup.
pub fn latest(conn: &Connection, ok: bool) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT created_at FROM backup_log WHERE ok = ?1 ORDER BY created_at DESC LIMIT 1",
        [ok],
        |r| r.get(0),
    )
    .optional()
}
