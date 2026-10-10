//! Auto-update (P4-T05) with `tauri-plugin-updater`: signed releases from GitHub. Checks only
//! when the user allows it (Settings › Updates, on by default) and never in development
//! builds. Installing always waits for the user's "Install and restart".

use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::{Error, Update, UpdaterExt};

use crate::commands::with_conn;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::update::UpdateInfo;
use crate::services::app_settings;

/// Sent to the main window when a background check finds a newer version.
pub const UPDATE_EVENT: &str = "update:available";
const FIRST_CHECK: Duration = Duration::from_secs(60);
const CHECK_EVERY: Duration = Duration::from_secs(24 * 60 * 60);

/// The update found by the last check, ready to install.
#[derive(Default)]
pub struct PendingUpdate(pub Mutex<Option<Update>>);

/// Plain reasons for `errors.update.<reason>`.
pub fn reason_for(error: &Error) -> &'static str {
    match error {
        Error::Reqwest(_) | Error::Network(_) => "offline",
        Error::ReleaseNotFound => "notFound",
        _ => "failed",
    }
}

pub async fn check(app: &AppHandle) -> AppResult<Option<UpdateInfo>> {
    let updater = app.updater().map_err(|_| AppError::Update("failed"))?;
    let found = updater
        .check()
        .await
        .map_err(|e| AppError::Update(reason_for(&e)))?;
    let info = found.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        notes: u.body.clone().filter(|b| !b.trim().is_empty()),
    });
    if let Some(state) = app.try_state::<PendingUpdate>() {
        *state.0.lock().map_err(|_| AppError::Lock)? = found;
    }
    Ok(info)
}

/// Downloads, verifies the signature, installs, and restarts Kairos.
pub async fn install(app: &AppHandle) -> AppResult<()> {
    let pending = app
        .try_state::<PendingUpdate>()
        .and_then(|s| s.0.lock().ok()?.take());
    let update = match pending {
        Some(update) => update,
        None => {
            check(app).await?;
            app.try_state::<PendingUpdate>()
                .and_then(|s| s.0.lock().ok()?.take())
                .ok_or(AppError::Update("notFound"))?
        }
    };
    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| AppError::Update(reason_for(&e)))?;
    app.restart()
}

fn auto_check_on(app: &AppHandle) -> bool {
    app.try_state::<Db>()
        .and_then(|db| with_conn(&db, |conn| Ok(app_settings::get(conn)?.auto_update_check)).ok())
        .unwrap_or(false)
}

/// A minute after start, then daily: look for an update if the user allows it.
pub fn start_background(app: AppHandle) {
    if cfg!(debug_assertions) {
        return; // development and E2E builds never check
    }
    std::thread::spawn(move || {
        std::thread::sleep(FIRST_CHECK);
        loop {
            if auto_check_on(&app)
                && let Ok(Some(info)) = tauri::async_runtime::block_on(check(&app))
            {
                let _ = app.emit(UPDATE_EVENT, info);
            }
            std::thread::sleep(CHECK_EVERY);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn explains_update_failures_plainly() {
        assert_eq!(reason_for(&Error::Network("down".into())), "offline");
        assert_eq!(reason_for(&Error::ReleaseNotFound), "notFound");
        assert_eq!(reason_for(&Error::EmptyEndpoints), "failed");
    }
}
