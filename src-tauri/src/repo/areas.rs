use rusqlite::{Connection, params};

use crate::models::area::Area;

/// Active (not deleted, not archived) areas in display order.
pub fn list_active(conn: &Connection) -> rusqlite::Result<Vec<Area>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, icon, sort_order, is_archived FROM areas
         WHERE deleted_at IS NULL AND is_archived = 0
         ORDER BY sort_order",
    )?;
    stmt.query_map([], |row| {
        Ok(Area {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            icon: row.get(3)?,
            sort_order: row.get(4)?,
            is_archived: row.get(5)?,
        })
    })?
    .collect()
}

pub struct NewArea<'a> {
    pub id: &'a str,
    pub name: &'a str,
    pub color: &'a str,
    pub icon: &'a str,
    pub sort_order: i64,
    pub now: &'a str,
}

pub fn insert(conn: &Connection, area: &NewArea) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO areas (id, name, color, icon, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![
            area.id,
            area.name,
            area.color,
            area.icon,
            area.sort_order,
            area.now
        ],
    )?;
    Ok(())
}

/// True if the area exists and is not deleted (archived areas can still hold items).
pub fn is_active(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM areas WHERE id = ?1 AND deleted_at IS NULL)",
        [id],
        |row| row.get(0),
    )
}

/// Area names in display order, excluding archived and deleted ones.
pub fn active_names(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT name FROM areas
         WHERE deleted_at IS NULL AND is_archived = 0
         ORDER BY sort_order",
    )?;
    stmt.query_map([], |row| row.get(0))?.collect()
}
