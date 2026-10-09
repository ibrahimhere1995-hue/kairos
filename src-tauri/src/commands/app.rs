use tauri::AppHandle;

use crate::window;

/// The frontend has painted its first (themed) frame: show the main window, unless Kairos
/// started hidden at sign-in.
#[tauri::command]
pub fn main_window_ready(app: AppHandle) {
    window::show_on_startup(&app);
}
