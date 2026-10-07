pub mod backup;
pub mod db;
pub mod error;
pub mod paths;
pub mod repo;
pub mod services;
pub mod startup;
pub mod util;

use std::time::Duration;

use tauri::Manager;

/// The main window starts hidden and the frontend shows it after its first themed paint
/// (no white flash). If that never happens, show it anyway so the user is never left with nothing.
const SHOW_WINDOW_FALLBACK: Duration = Duration::from_secs(3);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Development only: keep the WebView2 cache inside the project (.devdata), off the C: drive.
    #[cfg(all(debug_assertions, windows))]
    {
        let webview_dir = paths::dev_data_dir().join("webview");
        // SAFETY: runs first in `run`, before Tauri or any other thread starts,
        // so nothing can be reading the environment concurrently.
        unsafe { std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", webview_dir) };
    }

    // Startup-fatal: if the Tauri runtime cannot start there is no app to recover into.
    #[allow(clippy::expect_used)]
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = paths::data_dir(app.handle())?;
            app.manage(startup::open_database(&data_dir)?);

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
