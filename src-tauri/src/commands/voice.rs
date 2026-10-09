use tauri::{AppHandle, Manager, State};

use crate::error::{AppError, AppResult};
use crate::voice::{self, VoiceState};

/// Press: start listening. Runs off the UI thread (starting takes a moment).
#[tauri::command]
pub async fn voice_start(app: AppHandle) -> AppResult<()> {
    let handle = app.clone();
    let session = tauri::async_runtime::spawn_blocking(move || voice::imp::start(handle))
        .await
        .map_err(|_| AppError::Voice("failed"))??;
    voice::begin(&app.state::<VoiceState>(), session)
}

/// Release: stop and return the words heard ("" if nothing).
#[tauri::command]
pub async fn voice_stop(state: State<'_, VoiceState>) -> AppResult<String> {
    let Some(session) = voice::take(&state)? else {
        return Ok(String::new());
    };
    tauri::async_runtime::spawn_blocking(move || voice::imp::stop(session))
        .await
        .map_err(|_| AppError::Voice("failed"))?
}

/// Opens the Windows settings page that fixes `reason` (speech privacy or microphone).
#[tauri::command]
pub fn voice_open_settings(app: AppHandle, reason: String) -> AppResult<()> {
    use tauri_plugin_opener::OpenerExt;
    let page = if reason == "microphone" {
        "ms-settings:privacy-microphone"
    } else {
        "ms-settings:privacy-speech"
    };
    app.opener()
        .open_url(page, None::<&str>)
        .map_err(|_| AppError::Voice("failed"))
}
