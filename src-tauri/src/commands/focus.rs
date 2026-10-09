use std::sync::atomic::{AtomicBool, Ordering};

use chrono::Utc;
use tauri::{State, Window};

use crate::commands::with_conn;
use crate::db::Db;
use crate::error::AppResult;
use crate::models::focus::{FocusSession, FocusTotal};
use crate::services::focus;

/// While focus mode is on, Kairos holds its notifications; they arrive when it ends
/// (PRD R16). Read by the reminder loop.
#[derive(Default)]
pub struct FocusMute(AtomicBool);

impl FocusMute {
    pub fn is_on(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }
}

/// Enters or leaves focus mode: full screen, notifications held.
#[tauri::command]
pub fn set_focus_mode(window: Window, mute: State<'_, FocusMute>, active: bool) {
    mute.0.store(active, Ordering::Relaxed);
    // Best effort: focus mode still works in a normal window.
    if let Err(error) = window.set_fullscreen(active) {
        eprintln!("Full screen unavailable: {error}");
    }
}

#[tauri::command]
pub fn start_focus(
    db: State<'_, Db>,
    item_id: Option<String>,
    planned_minutes: i64,
) -> AppResult<FocusSession> {
    with_conn(&db, |conn| {
        focus::start(conn, item_id.as_deref(), planned_minutes, Utc::now())
    })
}

#[tauri::command]
pub fn stop_focus(db: State<'_, Db>, id: String) -> AppResult<()> {
    with_conn(&db, |conn| focus::stop(conn, &id, Utc::now()))
}

#[tauri::command]
pub fn focus_totals(db: State<'_, Db>, start: String, end: String) -> AppResult<Vec<FocusTotal>> {
    with_conn(&db, |conn| focus::totals(conn, &start, &end))
}
