//! Full-text search queries (P2-T09). `fts_query` is built by the search service from the
//! user's words and always passed as a parameter.

use rusqlite::{Connection, named_params};

use crate::models::item::Item;
use crate::repo::items::{columns_of, query_items};

/// Items whose title or notes match, best match first. Trash excluded.
pub fn items_matching(
    conn: &Connection,
    fts_query: &str,
    limit: i64,
) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {} FROM items_fts JOIN items i ON i.rowid = items_fts.rowid
             WHERE items_fts MATCH :q AND i.deleted_at IS NULL
             ORDER BY rank
             LIMIT :limit",
            columns_of("i")
        ),
        named_params! { ":q": fts_query, ":limit": limit },
    )
}

/// Items with a step that matches. Steps of a repeating series belong to the series row.
pub fn items_with_matching_steps(
    conn: &Connection,
    fts_query: &str,
    limit: i64,
) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {} FROM items i
             WHERE i.deleted_at IS NULL AND i.id IN (
               SELECT c.item_id FROM checklist_fts JOIN checklist_items c
                 ON c.rowid = checklist_fts.rowid
               WHERE checklist_fts MATCH :q AND c.deleted_at IS NULL)
             LIMIT :limit",
            columns_of("i")
        ),
        named_params! { ":q": fts_query, ":limit": limit },
    )
}

/// Unfinished items in areas whose name contains `like_pattern` (already lower-cased and
/// escaped with `\`), most recent moment first.
pub fn open_items_in_matching_areas(
    conn: &Connection,
    like_pattern: &str,
    limit: i64,
) -> rusqlite::Result<Vec<Item>> {
    query_items(
        conn,
        &format!(
            "SELECT {} FROM items i
             WHERE i.deleted_at IS NULL AND i.completed_at IS NULL AND i.skipped_at IS NULL
               AND i.area_id IN (SELECT id FROM areas
                                 WHERE deleted_at IS NULL AND lower(name) LIKE :p ESCAPE '\\')
             ORDER BY COALESCE(i.start_at, i.due_date) DESC
             LIMIT :limit",
            columns_of("i")
        ),
        named_params! { ":p": like_pattern, ":limit": limit },
    )
}
