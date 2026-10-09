//! Whole-database reads for "Export all data" (P2-T12).

use rusqlite::{Connection, named_params};
use serde::Serialize;

use crate::models::attachment::Attachment;
use crate::models::checklist::ChecklistItem;
use crate::models::item::Item;
use crate::repo::items::{columns_of, query_items};

/// Every item not in the Trash: single items, repeating series and their stored occurrences.
pub fn all_items(conn: &Connection) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {} FROM items i WHERE i.deleted_at IS NULL
             ORDER BY COALESCE(i.start_at, i.due_date), i.created_at",
            columns_of("i")
        ),
        named_params! {},
    )
}

pub fn all_steps(conn: &Connection) -> rusqlite::Result<Vec<ChecklistItem>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.item_id, c.text, c.done, c.sort_order FROM checklist_items c
         JOIN items i ON i.id = c.item_id
         WHERE c.deleted_at IS NULL AND i.deleted_at IS NULL
         ORDER BY c.item_id, c.sort_order",
    )?;
    stmt.query_map([], |row| {
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportedReminder {
    pub item_id: String,
    pub offset_minutes: i64,
}

pub fn all_reminders(conn: &Connection) -> rusqlite::Result<Vec<ExportedReminder>> {
    let mut stmt = conn.prepare(
        "SELECT r.item_id, r.offset_minutes FROM reminders r JOIN items i ON i.id = r.item_id
         WHERE r.deleted_at IS NULL AND i.deleted_at IS NULL ORDER BY r.item_id, r.offset_minutes",
    )?;
    stmt.query_map([], |row| {
        Ok(ExportedReminder {
            item_id: row.get(0)?,
            offset_minutes: row.get(1)?,
        })
    })?
    .collect()
}

pub fn all_attachments(conn: &Connection) -> rusqlite::Result<Vec<Attachment>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.item_id, a.file_name, a.mime, a.size_bytes, a.created_at
         FROM attachments a JOIN items i ON i.id = a.item_id
         WHERE a.deleted_at IS NULL AND i.deleted_at IS NULL ORDER BY a.created_at",
    )?;
    stmt.query_map([], |row| {
        Ok(Attachment {
            id: row.get(0)?,
            item_id: row.get(1)?,
            file_name: row.get(2)?,
            mime: row.get(3)?,
            size_bytes: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?
    .collect()
}

/// Is there already an item (not in the Trash) with this title at this moment?
/// Used so importing the same calendar twice doesn't duplicate everything.
pub fn exists_like(
    conn: &Connection,
    title: &str,
    start_at: Option<&str>,
    due_date: Option<&str>,
) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM items WHERE deleted_at IS NULL AND title = :t
           AND start_at IS :s AND due_date IS :d)",
        named_params! { ":t": title, ":s": start_at, ":d": due_date },
        |r| r.get(0),
    )
}
