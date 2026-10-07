//! Quick Capture window (PRD R4): a small always-on-top bar opened from anywhere with a
//! global shortcut. Defined hidden in tauri.conf.json; shown, centred and focused on demand.

use tauri::{AppHandle, Manager, Runtime};

pub const CAPTURE_WINDOW: &str = "capture";

/// PRD R4 default: Ctrl+Shift+Space on Windows, ⌘⇧Space on macOS.
pub const CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+Space";

/// Shows the capture bar, or hides it if it is already in front.
pub fn toggle<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(CAPTURE_WINDOW) else {
        return;
    };
    let visible = window.is_visible().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);
    // Window calls are best effort: a failed show/hide must never crash the app.
    if visible && focused {
        let _ = window.hide();
    } else {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
