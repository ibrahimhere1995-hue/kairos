//! Launch at login (PRD R3, P2-T03), on by default and toggled in Settings.
//! Kairos then starts hidden in the tray (`--hidden`).

use tauri::{AppHandle, Wry, plugin::TauriPlugin};
use tauri_plugin_autostart::MacosLauncher;

use crate::window::HIDDEN_FLAG;

pub fn plugin() -> TauriPlugin<Wry> {
    tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![HIDDEN_FLAG]))
}

/// Makes the OS start Kairos at sign-in, or stop doing so.
/// Development builds never register themselves (a debug build starting at every sign-in
/// would be surprising); the setting is still saved.
pub fn apply(app: &AppHandle, enabled: bool) {
    if cfg!(debug_assertions) {
        return;
    }
    use tauri_plugin_autostart::ManagerExt;
    let launcher = app.autolaunch();
    let result = match (enabled, launcher.is_enabled()) {
        (true, Ok(false)) => launcher.enable(),
        (false, Ok(true)) => launcher.disable(),
        (_, Err(error)) => Err(error),
        _ => Ok(()),
    };
    if let Err(error) = result {
        eprintln!("Launch at login could not be changed: {error}");
    }
}
