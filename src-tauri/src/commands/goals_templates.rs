use tauri::{AppHandle, State};

use crate::commands::{with_conn, write_items};
use crate::db::Db;
use crate::error::AppResult;
use crate::models::goal::{Goal, GoalInput, GoalProgress, Milestone};
use crate::models::item::Item;
use crate::services::templates::{self, Template};
use crate::services::{goals, items};

#[tauri::command]
pub fn list_goals(db: State<'_, Db>) -> AppResult<Vec<GoalProgress>> {
    with_conn(&db, |conn| goals::list(conn))
}

#[tauri::command]
pub fn create_goal(db: State<'_, Db>, input: GoalInput) -> AppResult<Goal> {
    with_conn(&db, |conn| goals::create(conn, &input))
}

#[tauri::command]
pub fn update_goal(db: State<'_, Db>, id: String, input: GoalInput) -> AppResult<Goal> {
    with_conn(&db, |conn| goals::update(conn, &id, &input))
}

#[tauri::command]
pub fn achieve_goal(db: State<'_, Db>, id: String, achieved: bool) -> AppResult<Goal> {
    with_conn(&db, |conn| goals::set_achieved(conn, &id, achieved))
}

/// Soft delete; `deleted: false` restores (Undo).
#[tauri::command]
pub fn delete_goal(db: State<'_, Db>, id: String, deleted: bool) -> AppResult<()> {
    with_conn(&db, |conn| goals::set_deleted(conn, &id, deleted))
}

#[tauri::command]
pub fn add_milestone(db: State<'_, Db>, goal_id: String, title: String) -> AppResult<Milestone> {
    with_conn(&db, |conn| goals::add_milestone(conn, &goal_id, &title))
}

#[tauri::command]
pub fn rename_milestone(db: State<'_, Db>, id: String, title: String) -> AppResult<()> {
    with_conn(&db, |conn| goals::rename_milestone(conn, &id, &title))
}

#[tauri::command]
pub fn delete_milestone(db: State<'_, Db>, id: String, deleted: bool) -> AppResult<()> {
    with_conn(&db, |conn| goals::set_milestone_deleted(conn, &id, deleted))
}

#[tauri::command]
pub fn list_templates(db: State<'_, Db>) -> AppResult<Vec<Template>> {
    with_conn(&db, |conn| templates::list(conn))
}

#[tauri::command]
pub fn create_template(
    db: State<'_, Db>,
    name: String,
    item_ids: Vec<String>,
) -> AppResult<Template> {
    with_conn(&db, |conn| templates::create(conn, &name, &item_ids))
}

#[tauri::command]
pub fn delete_template(db: State<'_, Db>, id: String, deleted: bool) -> AppResult<()> {
    with_conn(&db, |conn| templates::set_deleted(conn, &id, deleted))
}

#[tauri::command]
pub fn apply_template(
    app: AppHandle,
    db: State<'_, Db>,
    id: String,
    start_date: String,
) -> AppResult<Vec<Item>> {
    write_items(&app, &db, |conn| templates::apply(conn, &id, &start_date))
}

/// Moves several items to the Trash (Undo after inserting a template).
#[tauri::command]
pub fn delete_items(app: AppHandle, db: State<'_, Db>, ids: Vec<String>) -> AppResult<()> {
    write_items(&app, &db, |conn| {
        ids.iter().try_for_each(|id| items::delete(conn, id))
    })
}
