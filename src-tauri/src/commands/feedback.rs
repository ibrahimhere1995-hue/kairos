use std::path::PathBuf;

use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::commands::with_conn;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::feedback::{Feedback, FeedbackInput};
use crate::services::feedback;

#[tauri::command]
pub fn list_feedback(db: State<'_, Db>) -> AppResult<Vec<Feedback>> {
    with_conn(&db, |conn| feedback::list(conn))
}

#[tauri::command]
pub fn create_feedback(db: State<'_, Db>, input: FeedbackInput) -> AppResult<Feedback> {
    with_conn(&db, |conn| feedback::create(conn, &input))
}

#[tauri::command]
pub fn update_feedback(db: State<'_, Db>, id: String, input: FeedbackInput) -> AppResult<Feedback> {
    with_conn(&db, |conn| feedback::update(conn, &id, &input))
}

#[tauri::command]
pub fn set_feedback_status(db: State<'_, Db>, id: String, status: String) -> AppResult<Feedback> {
    with_conn(&db, |conn| feedback::set_status(conn, &id, &status))
}

/// Soft delete; `deleted: false` restores (Undo).
#[tauri::command]
pub fn delete_feedback(db: State<'_, Db>, id: String, deleted: bool) -> AppResult<()> {
    with_conn(&db, |conn| feedback::set_deleted(conn, &id, deleted))
}

/// The wishlist as a text file the user chose.
#[tauri::command]
pub fn export_feedback(db: State<'_, Db>, path: String) -> AppResult<()> {
    with_conn(&db, |conn| feedback::export(conn, &PathBuf::from(&path)))
}

/// Opens the user's mail app with the wishlist filled in. Kairos itself sends nothing.
#[tauri::command]
pub fn email_feedback(app: AppHandle, db: State<'_, Db>) -> AppResult<()> {
    let link = with_conn(&db, |conn| feedback::mailto(conn))?;
    app.opener()
        .open_url(link, None::<&str>)
        .map_err(|_| AppError::invalid("feedback", "emailFailed"))
}
