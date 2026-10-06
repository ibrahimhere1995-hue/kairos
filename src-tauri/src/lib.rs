use std::time::Duration;

use tauri::Manager;

/// The main window starts hidden and the frontend shows it after its first themed paint
/// (no white flash). If that never happens, show it anyway so the user is never left with nothing.
const SHOW_WINDOW_FALLBACK: Duration = Duration::from_secs(3);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Startup-fatal: if the Tauri runtime cannot start there is no app to recover into.
    #[allow(clippy::expect_used)]
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(SHOW_WINDOW_FALLBACK);
                    // Best effort: if showing fails the window is already gone.
                    let _ = window.show();
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Kairos");
}
