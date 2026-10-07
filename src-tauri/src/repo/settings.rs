use rusqlite::{Connection, OptionalExtension, params};

/// Raw JSON value for `key`, if set.
pub fn get(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
        row.get(0)
    })
    .optional()
}

/// Stores a raw JSON value, replacing any existing one.
pub fn set(conn: &Connection, key: &str, json_value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, json_value],
    )?;
    Ok(())
}
