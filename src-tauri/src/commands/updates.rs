use tauri::AppHandle;

use crate::error::AppResult;
use crate::models::update::UpdateInfo;
use crate::updates;

/// Settings › Updates › "Check now". `None` = Kairos is up to date.
#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> AppResult<Option<UpdateInfo>> {
    updates::check(&app).await
}

/// "Install and restart": only ever on the user's request.
#[tauri::command]
pub async fn install_update(app: AppHandle) -> AppResult<()> {
    updates::install(&app).await
}
