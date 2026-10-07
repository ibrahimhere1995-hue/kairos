use rusqlite::{Connection, params};

use crate::models::checklist::ChecklistItem;

/// Steps of an item that are not in the Trash, in display order.
pub fn list_for_item(conn: &Connection, item_id: &str) -> rusqlite::Result<Vec<ChecklistItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, item_id, text, done, sort_order FROM checklist_items
         WHERE item_id = ?1 AND deleted_at IS NULL
         ORDER BY sort_order, created_at",
    )?;
    stmt.query_map([item_id], |row| {
        Ok(ChecklistItem {
            id: row.get(0)?,
            item_id: row.get(1)?,
            text: row.get(2)?,
            done: row.get(3)?,
            sort_order: row.get(4)?,
        })
    })?
    .collect()
}

pub fn insert(conn: &Connection, entry: &ChecklistItem, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO checklist_items (id, item_id, text, done, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![
            entry.id,
            entry.item_id,
            entry.text,
            entry.done,
            entry.sort_order,
            now
        ],
    )?;
    Ok(())
}

pub fn update(conn: &Connection, entry: &ChecklistItem, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE checklist_items SET text = ?2, done = ?3, sort_order = ?4, updated_at = ?5
         WHERE id = ?1",
        params![entry.id, entry.text, entry.done, entry.sort_order, now],
    )?;
    Ok(())
}

pub fn soft_delete(conn: &Connection, id: &str, now: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE checklist_items SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1",
        params![id, now],
    )?;
    Ok(())
}
