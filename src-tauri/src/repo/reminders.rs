use rusqlite::{Connection, params};

use crate::models::reminder::{DueReminder, Reminder};

const COLUMNS: &str = "id, item_id, offset_minutes, fire_at, fired_at, snoozed_until";

fn from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Reminder> {
    Ok(Reminder {
        id: row.get(0)?,
        item_id: row.get(1)?,
        offset_minutes: row.get(2)?,
        fire_at: row.get(3)?,
        fired_at: row.get(4)?,
        snoozed_until: row.get(5)?,
    })
}

/// An item's reminders that are not in the Trash, nearest first.
pub fn list_for_item(conn: &Connection, item_id: &str) -> rusqlite::Result<Vec<Reminder>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM reminders WHERE item_id = ?1 AND deleted_at IS NULL
         ORDER BY offset_minutes"
    ))?;
    stmt.query_map([item_id], from_row)?.collect()
}

pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Reminder>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM reminders WHERE id = ?1 AND deleted_at IS NULL"
    ))?;
    let mut rows = stmt.query_map([id], from_row)?;
    rows.next().transpose()
}

/// Reminders still waiting to fire for the first time (not fired, not snoozed).
/// Their times depend on the time zone and the default reminder time, so they are recomputed
/// when either changes.
pub fn list_waiting(conn: &Connection) -> rusqlite::Result<Vec<Reminder>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM reminders
         WHERE deleted_at IS NULL AND fired_at IS NULL AND snoozed_until IS NULL"
    ))?;
    stmt.query_map([], from_row)?.collect()
}

pub fn insert(conn: &Connection, reminder: &Reminder, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO reminders
           (id, item_id, offset_minutes, fire_at, fired_at, snoozed_until, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![
            reminder.id,
            reminder.item_id,
            reminder.offset_minutes,
            reminder.fire_at,
            reminder.fired_at,
            reminder.snoozed_until,
            now
        ],
    )?;
    Ok(())
}

/// Saves the timing fields (`fire_at`, `fired_at`, `snoozed_until`).
pub fn update_timing(conn: &Connection, reminder: &Reminder, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE reminders SET fire_at = ?2, fired_at = ?3, snoozed_until = ?4, updated_at = ?5
         WHERE id = ?1",
        params![
            reminder.id,
            reminder.fire_at,
            reminder.fired_at,
            reminder.snoozed_until,
            now
        ],
    )?;
    Ok(())
}

pub fn soft_delete(conn: &Connection, id: &str, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE reminders SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1",
        params![id, now],
    )?;
    Ok(())
}

/// Reminders due at or before `now` whose item is still open (not done, skipped or trashed).
pub fn due(conn: &Connection, now: &str) -> rusqlite::Result<Vec<DueReminder>> {
    let mut stmt = conn.prepare(
        "SELECT r.id, r.item_id, i.title, i.start_at, i.due_date, r.fire_at
         FROM reminders r JOIN items i ON i.id = r.item_id
         WHERE r.deleted_at IS NULL AND r.fired_at IS NULL
           AND r.fire_at IS NOT NULL AND r.fire_at <= ?1
           AND i.deleted_at IS NULL AND i.completed_at IS NULL AND i.skipped_at IS NULL
         ORDER BY r.fire_at",
    )?;
    stmt.query_map([now], |row| {
        Ok(DueReminder {
            reminder_id: row.get(0)?,
            item_id: row.get(1)?,
            title: row.get(2)?,
            start_at: row.get(3)?,
            due_date: row.get(4)?,
            fire_at: row.get(5)?,
        })
    })?
    .collect()
}

/// The earliest upcoming fire time, so the scheduler can wake up right on time.
pub fn next_fire_at(conn: &Connection) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT MIN(r.fire_at) FROM reminders r JOIN items i ON i.id = r.item_id
         WHERE r.deleted_at IS NULL AND r.fired_at IS NULL AND r.fire_at IS NOT NULL
           AND i.deleted_at IS NULL AND i.completed_at IS NULL AND i.skipped_at IS NULL",
        [],
        |row| row.get(0),
    )
}
