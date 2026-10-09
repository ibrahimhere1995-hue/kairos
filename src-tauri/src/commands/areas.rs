use tauri::{AppHandle, Emitter, Runtime, State};

use crate::commands::with_conn;
use crate::db::Db;
use crate::error::AppResult;
use crate::models::area::{Area, AreaInput};
use crate::services::areas;

/// Sent to every window after areas change (names and colours appear everywhere,
/// and Quick Capture matches `#area` by name).
pub const AREAS_CHANGED: &str = "areas:changed";

fn write_areas<R: Runtime, T>(
    app: &AppHandle<R>,
    db: &Db,
    f: impl FnOnce(&mut rusqlite::Connection) -> AppResult<T>,
) -> AppResult<T> {
    let result = with_conn(db, f)?;
    // Best effort: views also refetch on focus.
    let _ = app.emit(AREAS_CHANGED, ());
    Ok(result)
}

/// Every area that isn't deleted, archived ones included (pickers hide those).
#[tauri::command]
pub fn list_areas(db: State<'_, Db>) -> AppResult<Vec<Area>> {
    with_conn(&db, |conn| areas::list(conn))
}

#[tauri::command]
pub fn create_area(app: AppHandle, db: State<'_, Db>, input: AreaInput) -> AppResult<Area> {
    write_areas(&app, &db, |conn| areas::create(conn, &input))
}

#[tauri::command]
pub fn update_area(
    app: AppHandle,
    db: State<'_, Db>,
    id: String,
    input: AreaInput,
) -> AppResult<Area> {
    write_areas(&app, &db, |conn| areas::update(conn, &id, &input))
}

#[tauri::command]
pub fn archive_area(
    app: AppHandle,
    db: State<'_, Db>,
    id: String,
    archived: bool,
) -> AppResult<Area> {
    write_areas(&app, &db, |conn| areas::set_archived(conn, &id, archived))
}

#[tauri::command]
pub fn reorder_areas(app: AppHandle, db: State<'_, Db>, ids: Vec<String>) -> AppResult<Vec<Area>> {
    write_areas(&app, &db, |conn| areas::reorder(conn, &ids))
}
