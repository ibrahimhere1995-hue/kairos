use rusqlite::{Connection, OptionalExtension, params};

use crate::models::habit::Habit;

const COLUMNS: &str = "id, title, area_id, frequency, created_at";

fn from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Habit> {
    Ok(Habit {
        id: row.get(0)?,
        title: row.get(1)?,
        area_id: row.get(2)?,
        frequency: row.get(3)?,
        created_at: row.get(4)?,
    })
}

pub fn list_active(conn: &Connection) -> rusqlite::Result<Vec<Habit>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM habits WHERE deleted_at IS NULL ORDER BY created_at, id"
    ))?;
    stmt.query_map([], from_row)?.collect()
}

/// Including deleted ones (for restore).
pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<(Habit, bool)>> {
    conn.query_row(
        &format!("SELECT {COLUMNS}, deleted_at IS NOT NULL FROM habits WHERE id = ?1"),
        [id],
        |r| Ok((from_row(r)?, r.get(5)?)),
    )
    .optional()
}

pub fn insert(conn: &Connection, h: &Habit) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO habits (id, title, area_id, frequency, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![h.id, h.title, h.area_id, h.frequency, h.created_at],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, h: &Habit, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE habits SET title = ?2, area_id = ?3, frequency = ?4, updated_at = ?5 WHERE id = ?1",
        params![h.id, h.title, h.area_id, h.frequency, now],
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
        "UPDATE habits SET deleted_at = ?2, updated_at = ?3 WHERE id = ?1",
        params![id, deleted_at, now],
    )?;
    Ok(())
}

/// Ticked dates from `since` (inclusive), oldest first.
pub fn log_dates(conn: &Connection, habit_id: &str, since: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT log_date FROM habit_logs WHERE habit_id = ?1 AND log_date >= ?2 ORDER BY log_date",
    )?;
    stmt.query_map(params![habit_id, since], |r| r.get(0))?
        .collect()
}

pub fn add_log(
    conn: &Connection,
    id: &str,
    habit_id: &str,
    date: &str,
    now: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO habit_logs (id, habit_id, log_date, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, habit_id, date, now],
    )?;
    Ok(())
}

pub fn remove_log(conn: &Connection, habit_id: &str, date: &str) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM habit_logs WHERE habit_id = ?1 AND log_date = ?2",
        params![habit_id, date],
    )?;
    Ok(())
}
