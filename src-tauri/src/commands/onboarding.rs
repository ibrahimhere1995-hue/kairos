use tauri::{AppHandle, State};

use crate::commands::{with_conn, write_items};
use crate::db::Db;
use crate::error::AppResult;
use crate::services::onboarding::{self, OnboardingInput, OnboardingStatus};

#[tauri::command]
pub fn get_onboarding(db: State<'_, Db>) -> AppResult<OnboardingStatus> {
    with_conn(&db, |conn| onboarding::status(conn))
}

#[tauri::command]
pub fn finish_onboarding(
    app: AppHandle,
    db: State<'_, Db>,
    input: OnboardingInput,
) -> AppResult<OnboardingStatus> {
    write_items(&app, &db, |conn| onboarding::finish(conn, &input))
}

#[tauri::command]
pub fn skip_onboarding(app: AppHandle, db: State<'_, Db>) -> AppResult<OnboardingStatus> {
    write_items(&app, &db, onboarding::skip)
}

#[tauri::command]
pub fn remove_sample_tasks(app: AppHandle, db: State<'_, Db>) -> AppResult<usize> {
    write_items(&app, &db, onboarding::remove_samples)
}
