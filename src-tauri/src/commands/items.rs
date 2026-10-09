use tauri::{AppHandle, State};

use crate::commands::{with_conn, write_items};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::checklist::{ChecklistEntryInput, ChecklistItem, ItemDetail};
use crate::models::dashboard::{Dashboard, DashboardQuery};
use crate::models::inputs::{DateRange, ItemFilters, ItemInput, ScheduleInput};
use crate::models::item::Item;
use crate::services::search::{self, SearchHit};
use crate::services::series::EditScope;
use crate::services::{checklist, items};

#[tauri::command]
pub fn create_item(app: AppHandle, db: State<'_, Db>, input: ItemInput) -> AppResult<Item> {
    write_items(&app, &db, |conn| items::create(conn, &input))
}

/// `scope` matters only for repeating items: only this occurrence (default) or this and following.
#[tauri::command]
pub fn update_item(
    app: AppHandle,
    db: State<'_, Db>,
    id: String,
    input: ItemInput,
    scope: Option<EditScope>,
) -> AppResult<Item> {
    let scope = scope.unwrap_or_default();
    write_items(&app, &db, |conn| {
        items::update_scoped(conn, &id, &input, scope)
    })
}

#[tauri::command]
pub fn delete_item(
    app: AppHandle,
    db: State<'_, Db>,
    id: String,
    scope: Option<EditScope>,
) -> AppResult<()> {
    let scope = scope.unwrap_or_default();
    write_items(&app, &db, |conn| items::delete_scoped(conn, &id, scope))
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

#[tauri::command]
pub fn reschedule_items(
    app: AppHandle,
    db: State<'_, Db>,
    ids: Vec<String>,
    schedule: ScheduleInput,
) -> AppResult<Vec<Item>> {
    write_items(&app, &db, |conn| {
        items::reschedule_many(conn, &ids, &schedule)
    })
}

#[tauri::command]
pub fn skip_item(app: AppHandle, db: State<'_, Db>, id: String) -> AppResult<Item> {
    write_items(&app, &db, |conn| items::skip(conn, &id))
}

#[tauri::command]
pub fn unskip_item(app: AppHandle, db: State<'_, Db>, id: String) -> AppResult<Item> {
    write_items(&app, &db, |conn| items::unskip(conn, &id))
}

#[tauri::command]
pub fn list_unscheduled(db: State<'_, Db>) -> AppResult<Vec<Item>> {
    with_conn(&db, |conn| items::unscheduled(conn))
}

/// Global search (Ctrl/⌘+K): titles, notes, steps, area names.
#[tauri::command]
pub fn search(db: State<'_, Db>, query: String) -> AppResult<Vec<SearchHit>> {
    with_conn(&db, |conn| search::search(conn, &query))
}
