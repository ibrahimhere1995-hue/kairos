use tauri::State;

use crate::commands::with_conn;
use crate::db::Db;
use crate::error::AppResult;
use crate::models::dashboard::{Dashboard, DashboardQuery};
use crate::models::inputs::{DateRange, ItemFilters, ItemInput, ScheduleInput};
use crate::models::item::Item;
use crate::services::items;

#[tauri::command]
pub fn create_item(db: State<'_, Db>, input: ItemInput) -> AppResult<Item> {
    with_conn(&db, |conn| items::create(conn, &input))
}

#[tauri::command]
pub fn update_item(db: State<'_, Db>, id: String, input: ItemInput) -> AppResult<Item> {
    with_conn(&db, |conn| items::update(conn, &id, &input))
}

#[tauri::command]
pub fn delete_item(db: State<'_, Db>, id: String) -> AppResult<()> {
    with_conn(&db, |conn| items::delete(conn, &id))
}

#[tauri::command]
pub fn restore_item(db: State<'_, Db>, id: String) -> AppResult<Item> {
    with_conn(&db, |conn| items::restore(conn, &id))
}

#[tauri::command]
pub fn complete_item(db: State<'_, Db>, id: String) -> AppResult<Item> {
    with_conn(&db, |conn| items::complete(conn, &id))
}

#[tauri::command]
pub fn uncomplete_item(db: State<'_, Db>, id: String) -> AppResult<Item> {
    with_conn(&db, |conn| items::uncomplete(conn, &id))
}

#[tauri::command]
pub fn reschedule_item(db: State<'_, Db>, id: String, schedule: ScheduleInput) -> AppResult<Item> {
    with_conn(&db, |conn| items::reschedule(conn, &id, &schedule))
}

#[tauri::command]
pub fn list_items(
    db: State<'_, Db>,
    range: DateRange,
    filters: Option<ItemFilters>,
) -> AppResult<Vec<Item>> {
    let filters = filters.unwrap_or_default();
    with_conn(&db, |conn| items::list(conn, &range, &filters))
}

#[tauri::command]
pub fn get_dashboard(db: State<'_, Db>, query: DashboardQuery) -> AppResult<Dashboard> {
    with_conn(&db, |conn| items::dashboard(conn, &query))
}
