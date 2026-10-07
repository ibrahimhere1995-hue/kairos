use tauri::{AppHandle, State};

use crate::commands::{with_conn, write_items};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::checklist::{ChecklistEntryInput, ChecklistItem, ItemDetail};
use crate::models::dashboard::{Dashboard, DashboardQuery};
use crate::models::inputs::{DateRange, ItemFilters, ItemInput, ScheduleInput};
use crate::models::item::Item;
use crate::services::{checklist, items};

#[tauri::command]
pub fn create_item(app: AppHandle, db: State<'_, Db>, input: ItemInput) -> AppResult<Item> {
    write_items(&app, &db, |conn| items::create(conn, &input))
}

#[tauri::command]
pub fn update_item(
    app: AppHandle,
    db: State<'_, Db>,
    id: String,
    input: ItemInput,
) -> AppResult<Item> {
    write_items(&app, &db, |conn| items::update(conn, &id, &input))
}

#[tauri::command]
pub fn delete_item(app: AppHandle, db: State<'_, Db>, id: String) -> AppResult<()> {
    write_items(&app, &db, |conn| items::delete(conn, &id))
}

#[tauri::command]
pub fn restore_item(app: AppHandle, db: State<'_, Db>, id: String) -> AppResult<Item> {
    write_items(&app, &db, |conn| items::restore(conn, &id))
}

#[tauri::command]
pub fn complete_item(app: AppHandle, db: State<'_, Db>, id: String) -> AppResult<Item> {
    write_items(&app, &db, |conn| items::complete(conn, &id))
}

#[tauri::command]
pub fn uncomplete_item(app: AppHandle, db: State<'_, Db>, id: String) -> AppResult<Item> {
    write_items(&app, &db, |conn| items::uncomplete(conn, &id))
}

#[tauri::command]
pub fn reschedule_item(
    app: AppHandle,
    db: State<'_, Db>,
    id: String,
    schedule: ScheduleInput,
) -> AppResult<Item> {
    write_items(&app, &db, |conn| items::reschedule(conn, &id, &schedule))
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
pub fn get_item_detail(db: State<'_, Db>, id: String) -> AppResult<ItemDetail> {
    with_conn(&db, |conn| checklist::get_detail(conn, &id))
}

#[tauri::command]
pub fn set_checklist(
    app: AppHandle,
    db: State<'_, Db>,
    item_id: String,
    entries: Vec<ChecklistEntryInput>,
) -> AppResult<Vec<ChecklistItem>> {
    write_items(&app, &db, |conn| {
        checklist::set_checklist(conn, &item_id, &entries)
    })
}

#[tauri::command]
pub fn get_dashboard(db: State<'_, Db>, query: DashboardQuery) -> AppResult<Dashboard> {
    with_conn(&db, |conn| items::dashboard(conn, &query))
}
