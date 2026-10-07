use tauri::State;

use crate::commands::with_conn;
use crate::db::Db;
use crate::error::AppResult;
use crate::models::area::Area;
use crate::repo::areas;

#[tauri::command]
pub fn list_areas(db: State<'_, Db>) -> AppResult<Vec<Area>> {
    with_conn(&db, |conn| Ok(areas::list_active(conn)?))
}
