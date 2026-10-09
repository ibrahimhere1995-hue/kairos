use rusqlite::types::Type;
use rusqlite::{Connection, OptionalExtension, Row, named_params, params};

use crate::models::item::{Item, ItemKind, ItemSource};

const COLUMNS: &str = "id, kind, title, notes, area_id, priority, all_day, start_at, end_at, \
     due_date, completed_at, skipped_at, location, rrule, recurrence_parent_id, \
     original_start_at, milestone_id, reschedule_count, source, created_at, updated_at, deleted_at";

/// A single item or a stored occurrence, not a repeating series row: series show up through
/// their computed occurrences (`services::recurrence`).
const NOT_SERIES: &str = "rrule IS NULL";

/// Not deleted, not finished (completed or skipped), not a series row.
const OPEN: &str =
    "deleted_at IS NULL AND completed_at IS NULL AND skipped_at IS NULL AND rrule IS NULL";

fn bad_text(index: usize, value: &str) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(
        index,
        Type::Text,
        format!("unknown value {value:?}").into(),
    )
}

fn map_row(row: &Row) -> rusqlite::Result<Item> {
    let kind: String = row.get(1)?;
    let source: String = row.get(18)?;
    Ok(Item {
        id: row.get(0)?,
        kind: ItemKind::parse(&kind).ok_or_else(|| bad_text(1, &kind))?,
        title: row.get(2)?,
        notes: row.get(3)?,
        area_id: row.get(4)?,
        priority: row.get(5)?,
        all_day: row.get(6)?,
        start_at: row.get(7)?,
        end_at: row.get(8)?,
        due_date: row.get(9)?,
        completed_at: row.get(10)?,
        skipped_at: row.get(11)?,
        location: row.get(12)?,
        rrule: row.get(13)?,
        recurrence_parent_id: row.get(14)?,
        original_start_at: row.get(15)?,
        milestone_id: row.get(16)?,
        reschedule_count: row.get(17)?,
        source: ItemSource::parse(&source).ok_or_else(|| bad_text(18, &source))?,
        created_at: row.get(19)?,
        updated_at: row.get(20)?,
        deleted_at: row.get(21)?,
    })
}

fn query_items(
    conn: &Connection,
    sql: &str,
    params: &[(&str, &dyn rusqlite::ToSql)],
) -> rusqlite::Result<Vec<Item>> {
    let mut stmt = conn.prepare(sql)?;
    stmt.query_map(params, map_row)?.collect()
}

/// Fetches an item, including soft-deleted ones (callers decide what deleted means).
pub fn get(conn: &Connection, id: &str) -> rusqlite::Result<Option<Item>> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM items WHERE id = ?1"),
        [id],
        map_row,
    )
    .optional()
}

/// Items in the Trash, most recently deleted first. Occurrences of a deleted series are not
/// listed separately: they come back with the series.
pub fn list_deleted(conn: &Connection) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM items
             WHERE deleted_at IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM items p
                               WHERE p.id = items.recurrence_parent_id AND p.deleted_at IS NOT NULL)
             ORDER BY deleted_at DESC"
        ),
        &[],
    )
}

/// Repeating series that aren't in the Trash.
pub fn list_series(conn: &Connection) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM items
             WHERE rrule IS NOT NULL AND recurrence_parent_id IS NULL AND deleted_at IS NULL
             ORDER BY created_at"
        ),
        &[],
    )
}

/// Stored occurrences (done, moved or deleted ones) of a series, deleted ones included.
pub fn list_exceptions(conn: &Connection, series_id: &str) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!("SELECT {COLUMNS} FROM items WHERE recurrence_parent_id = :series"),
        named_params! { ":series": series_id },
    )
}

/// Trash items deleted before `cutoff` (all of them when `cutoff` is None).
const IN_TRASH: &str = "deleted_at IS NOT NULL AND (?1 IS NULL OR deleted_at < ?1)";

pub fn count_deleted(conn: &Connection, cutoff: Option<&str>) -> rusqlite::Result<i64> {
    conn.query_row(
        &format!("SELECT COUNT(*) FROM items WHERE {IN_TRASH}"),
        [cutoff],
        |r| r.get(0),
    )
}

/// Permanently removes Trash items (and their steps and reminders). Callers must back up first
/// (PROJECT_RULES #1) and run this inside a transaction.
pub fn purge_deleted(conn: &Connection, cutoff: Option<&str>) -> rusqlite::Result<usize> {
    let doomed = format!("SELECT id FROM items WHERE {IN_TRASH}");
    conn.execute(
        &format!("DELETE FROM checklist_items WHERE item_id IN ({doomed})"),
        [cutoff],
    )?;
    conn.execute(
        &format!("DELETE FROM reminders WHERE item_id IN ({doomed})"),
        [cutoff],
    )?;
    conn.execute(
        &format!(
            "UPDATE items SET recurrence_parent_id = NULL WHERE recurrence_parent_id IN ({doomed})"
        ),
        [cutoff],
    )?;
    conn.execute(&format!("DELETE FROM items WHERE {IN_TRASH}"), [cutoff])
}

pub fn insert(conn: &Connection, item: &Item) -> rusqlite::Result<()> {
    conn.execute(
        &format!(
            "INSERT INTO items ({COLUMNS}) VALUES \
             (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)"
        ),
        params![
            item.id,
            item.kind.as_str(),
            item.title,
            item.notes,
            item.area_id,
            item.priority,
            item.all_day,
            item.start_at,
            item.end_at,
            item.due_date,
            item.completed_at,
            item.skipped_at,
            item.location,
            item.rrule,
            item.recurrence_parent_id,
            item.original_start_at,
            item.milestone_id,
            item.reschedule_count,
            item.source.as_str(),
            item.created_at,
            item.updated_at,
            item.deleted_at,
        ],
    )?;
    Ok(())
}

/// Writes every mutable column of an existing item (services build the new state).
pub fn update(conn: &Connection, item: &Item) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE items SET kind = ?2, title = ?3, notes = ?4, area_id = ?5, priority = ?6,
            all_day = ?7, start_at = ?8, end_at = ?9, due_date = ?10, completed_at = ?11,
            skipped_at = ?12, location = ?13, reschedule_count = ?14, updated_at = ?15,
            deleted_at = ?16, rrule = ?17, recurrence_parent_id = ?18
         WHERE id = ?1",
        params![
            item.id,
            item.kind.as_str(),
            item.title,
            item.notes,
            item.area_id,
            item.priority,
            item.all_day,
            item.start_at,
            item.end_at,
            item.due_date,
            item.completed_at,
            item.skipped_at,
            item.location,
            item.reschedule_count,
            item.updated_at,
            item.deleted_at,
            item.rrule,
            item.recurrence_parent_id,
        ],
    )
}

/// Open tasks without a date (the Inbox), newest first, for time-blocking (P2-T07).
/// Capped at `limit` so a huge Inbox never loads all at once.
pub fn list_unscheduled(conn: &Connection, limit: i64) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM items
             WHERE {OPEN} AND kind = 'task'
               AND start_at IS NULL AND due_date IS NULL
             ORDER BY created_at DESC, id DESC
             LIMIT :limit"
        ),
        named_params! { ":limit": limit },
    )
}

/// Items overlapping a visible range (never "load all items" — PROJECT_RULES performance).
/// Timed items overlap `[start, end)`; date-only items fall in `[start_date, end_date)`.
pub fn list_in_range(
    conn: &Connection,
    start: &str,
    end: &str,
    start_date: &str,
    end_date: &str,
) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM items
             WHERE deleted_at IS NULL AND {NOT_SERIES} AND (
               (due_date >= :start_date AND due_date < :end_date)
               OR (start_at < :end AND (
                     (end_at IS NULL AND start_at >= :start) OR end_at > :start))
             )
             ORDER BY COALESCE(start_at, due_date), created_at"
        ),
        named_params! {
            ":start": start, ":end": end, ":start_date": start_date, ":end_date": end_date,
        },
    )
}

/// Unfinished items scheduled at any time today (timed items overlapping the local day).
pub fn open_today(
    conn: &Connection,
    day_start: &str,
    day_end: &str,
    today: &str,
) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM items
             WHERE {OPEN} AND (
               due_date = :today
               OR (start_at < :day_end AND (
                     (end_at IS NULL AND start_at >= :day_start) OR end_at > :day_start))
             )
             ORDER BY start_at IS NULL, start_at, priority DESC, created_at"
        ),
        named_params! { ":day_start": day_start, ":day_end": day_end, ":today": today },
    )
}

/// Unfinished tasks scheduled before today (events never slip — PRD §6).
pub fn overdue_tasks(
    conn: &Connection,
    day_start: &str,
    today: &str,
) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM items
             WHERE {OPEN} AND kind = 'task'
               AND (due_date < :today OR start_at < :day_start)
             ORDER BY COALESCE(start_at, due_date), created_at"
        ),
        named_params! { ":day_start": day_start, ":today": today },
    )
}

/// Unfinished items scheduled after today and before the end of the week.
pub fn open_rest_of_week(
    conn: &Connection,
    day_end: &str,
    today: &str,
    week_end: &str,
    week_end_date: &str,
) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM items
             WHERE {OPEN} AND (
               (due_date > :today AND due_date < :week_end_date)
               OR (start_at >= :day_end AND start_at < :week_end)
             )
             ORDER BY COALESCE(start_at, due_date), created_at"
        ),
        named_params! {
            ":day_end": day_end, ":today": today,
            ":week_end": week_end, ":week_end_date": week_end_date,
        },
    )
}

/// Items completed during the local day `[day_start, day_end)`, most recent first.
pub fn completed_between(
    conn: &Connection,
    day_start: &str,
    day_end: &str,
) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {COLUMNS} FROM items
             WHERE deleted_at IS NULL AND {NOT_SERIES}
               AND completed_at >= :day_start AND completed_at < :day_end
             ORDER BY completed_at DESC"
        ),
        named_params! { ":day_start": day_start, ":day_end": day_end },
    )
}
