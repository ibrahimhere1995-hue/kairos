//! The main window: shown after its first paint, hidden to the tray on close (PRD R3),
//! and kept hidden when Kairos starts at sign-in.

use tauri::{AppHandle, Manager, Runtime};

pub const MAIN_WINDOW: &str = "main";

/// Command-line flag added by "launch at login": start quietly in the tray.
pub const HIDDEN_FLAG: &str = "--hidden";

/// Whether this run started at sign-in, without showing the window.
pub struct StartHidden(pub bool);

impl StartHidden {
    pub fn from_args() -> Self {
        Self(std::env::args().any(|arg| arg == HIDDEN_FLAG))
    }
}

/// Brings the main window to the front. Best effort: window calls never crash the app.
pub fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// First show after start-up (after the first themed paint, or the fallback timer),
/// unless Kairos started hidden at sign-in.
pub fn show_on_startup<R: Runtime>(app: &AppHandle<R>) {
    let hidden = app.try_state::<StartHidden>().is_some_and(|s| s.0);
    if !hidden && let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.show();
    }
}
