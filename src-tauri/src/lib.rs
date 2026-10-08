pub mod backup;
pub mod capture;
pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod paths;
pub mod repo;
pub mod services;
pub mod startup;
pub mod util;

use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager, RunEvent};

use crate::backup::naming::LABEL_AUTO;
use crate::db::Db;
use crate::paths::AppPaths;
use crate::services::backups;
use crate::startup::StartupNoticeState;

/// The main window starts hidden and the frontend shows it after its first themed paint
/// (no white flash). If that never happens, show it anyway so the user is never left with nothing.
const SHOW_WINDOW_FALLBACK: Duration = Duration::from_secs(3);
/// How often the background thread checks whether 24 hours have passed since the last backup.
const BACKUP_CHECK_INTERVAL: Duration = Duration::from_secs(30 * 60);
/// Let startup settle before the first check.
const FIRST_BACKUP_CHECK: Duration = Duration::from_secs(60);

/// Registers Ctrl/⌘+Shift+Space for Quick Capture. If another app already owns the
/// shortcut, Kairos still starts: the in-app "+ Add task" bar works without it.
#[cfg(desktop)]
fn register_capture_shortcut(app: &tauri::App) {
    use tauri_plugin_global_shortcut::ShortcutState;

    let plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcut(capture::CAPTURE_SHORTCUT)
        .map(|builder| {
            builder
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        capture::toggle(app);
                    }
                })
                .build()
        });
    match plugin {
        Ok(plugin) => {
            if let Err(error) = app.handle().plugin(plugin) {
                eprintln!("Quick Capture shortcut unavailable: {error}");
            }
        }
        Err(error) => eprintln!("Quick Capture shortcut unavailable: {error}"),
    }
}

/// Makes an automatic backup (PRD R5). `only_if_due`: the 24-hour rule; on close it always runs.
fn automatic_backup(app: &AppHandle, only_if_due: bool) {
    let (Some(db), Some(paths)) = (app.try_state::<Db>(), app.try_state::<AppPaths>()) else {
        return;
    };
    if only_if_due {
        let due =
            db.0.lock()
                .ok()
                .and_then(|conn| backups::is_auto_due(&conn, chrono::Utc::now()).ok())
                .unwrap_or(false);
        if !due {
            return;
        }
    }
    // Failures are logged in backup_log and shown in Settings › Backups.
    if let Err(error) = backups::backup_now(&db, &paths, LABEL_AUTO) {
        eprintln!("Automatic backup failed: {error}");
    }
}

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
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = paths::data_dir(app.handle())?;
            let (db, notice) = startup::open_database(&data_dir)?;
            app.manage(db);
            app.manage(AppPaths::new(data_dir));
            app.manage(StartupNoticeState(Mutex::new(notice)));

            #[cfg(desktop)]
            register_capture_shortcut(app);

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(FIRST_BACKUP_CHECK);
                loop {
                    automatic_backup(&handle, true);
                    std::thread::sleep(BACKUP_CHECK_INTERVAL);
                }
            });

            if let Some(window) = app.get_webview_window("main") {
                std::thread::spawn(move || {
                    std::thread::sleep(SHOW_WINDOW_FALLBACK);
                    // Best effort: if showing fails the window is already gone.
                    let _ = window.show();
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::items::create_item,
            commands::items::update_item,
            commands::items::delete_item,
            commands::items::restore_item,
            commands::items::complete_item,
            commands::items::uncomplete_item,
            commands::items::reschedule_item,
            commands::items::list_items,
            commands::items::get_dashboard,
            commands::items::get_item_detail,
            commands::items::set_checklist,
            commands::areas::list_areas,
            commands::trash::list_trash,
            commands::trash::empty_trash,
            commands::backups::list_backups,
            commands::backups::backup_now,
            commands::backups::restore_backup,
            commands::backups::get_backup_settings,
            commands::backups::set_backup_folder,
            commands::backups::take_startup_notice,
            commands::settings::get_settings,
            commands::settings::update_settings,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Kairos");

    app.run(|handle, event| {
        // PRD R5: back up every time the app closes.
        if let RunEvent::Exit = event {
            automatic_backup(handle, false);
        }
    });
}
