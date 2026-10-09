use std::path::PathBuf;

use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, State};

use crate::commands::{with_conn, write_items};
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::habit::{Habit, HabitInput, HabitStatus};
use crate::models::item::Item;
use crate::paths::AppPaths;
use crate::services::habits;
use crate::services::inbox::{self, InboxEntry};

#[tauri::command]
pub fn list_inbox(db: State<'_, Db>) -> AppResult<Vec<InboxEntry>> {
    with_conn(&db, |conn| inbox::list(conn))
}

#[tauri::command]
pub fn add_inbox_text(db: State<'_, Db>, text: String) -> AppResult<InboxEntry> {
    with_conn(&db, |conn| inbox::add_text(conn, &text))
}

/// A pasted picture: the raw image bytes are the request body (fast, no JSON), and the
/// `x-image-type` header says its type, e.g. `png`.
#[tauri::command]
pub fn add_inbox_image(
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
    request: Request<'_>,
) -> AppResult<InboxEntry> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(AppError::invalid("image", "outOfRange"));
    };
    let ext = request
        .headers()
        .get("x-image-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("png");
    with_conn(&db, |conn| {
        inbox::add_image(conn, &paths.attachments_dir, bytes, ext, None)
    })
}

#[tauri::command]
pub fn add_inbox_image_file(
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
    path: String,
) -> AppResult<InboxEntry> {
    with_conn(&db, |conn| {
        inbox::add_image_file(conn, &paths.attachments_dir, &PathBuf::from(path))
    })
}

#[tauri::command]
pub fn inbox_image(db: State<'_, Db>, paths: State<'_, AppPaths>, id: String) -> AppResult<String> {
    with_conn(&db, |conn| {
        inbox::image_data_url(conn, &paths.attachments_dir, &id)
    })
}

#[tauri::command]
pub fn process_inbox_entry(
    app: AppHandle,
    db: State<'_, Db>,
    paths: State<'_, AppPaths>,
    id: String,
) -> AppResult<Item> {
    write_items(&app, &db, |conn| {
        inbox::process(conn, &paths.attachments_dir, &id)
    })
}

#[tauri::command]
pub fn delete_inbox_entry(db: State<'_, Db>, id: String, deleted: bool) -> AppResult<()> {
    with_conn(&db, |conn| inbox::set_deleted(conn, &id, deleted))
}

#[tauri::command]
pub fn list_habits(db: State<'_, Db>, today: String) -> AppResult<Vec<HabitStatus>> {
    with_conn(&db, |conn| habits::list(conn, &today))
}

#[tauri::command]
pub fn create_habit(db: State<'_, Db>, input: HabitInput) -> AppResult<Habit> {
    with_conn(&db, |conn| habits::create(conn, &input))
}

#[tauri::command]
pub fn update_habit(db: State<'_, Db>, id: String, input: HabitInput) -> AppResult<Habit> {
    with_conn(&db, |conn| habits::update(conn, &id, &input))
}

/// Soft delete; `deleted: false` restores (Undo).
#[tauri::command]
pub fn delete_habit(db: State<'_, Db>, id: String, deleted: bool) -> AppResult<()> {
    with_conn(&db, |conn| {
        if deleted {
            habits::delete(conn, &id)
        } else {
            habits::restore(conn, &id)
        }
    })
}

#[tauri::command]
pub fn set_habit_done(
    db: State<'_, Db>,
    id: String,
    date: String,
    today: String,
    done: bool,
) -> AppResult<()> {
    with_conn(&db, |conn| habits::set_done(conn, &id, &date, &today, done))
}
