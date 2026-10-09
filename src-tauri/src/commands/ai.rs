//! Smart features (P3-T08, P3-T10). Network calls happen only after consent and with a key;
//! the database lock is never held while waiting on the network.

use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::ai::gemini::Gemini;
use crate::ai::{parse, secrets};
use crate::commands::with_conn;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::ai::{AiDraft, AiStatus};
use crate::services::app_settings;

const KEY_PAGE: &str = "https://aistudio.google.com/apikey";
const KEY_MAX: usize = 200;

fn consented(db: &Db) -> AppResult<bool> {
    with_conn(
        db,
        |conn| Ok(app_settings::ai_consented_at(conn)?.is_some()),
    )
}

/// The provider, if smart features are on (consent given and a key saved).
fn provider(db: &Db) -> AppResult<Gemini> {
    if !consented(db)? {
        return Err(AppError::Ai("off"));
    }
    let key = secrets::get_key()?.ok_or(AppError::Ai("off"))?;
    Gemini::new(key)
}

#[tauri::command]
pub fn ai_status(db: State<'_, Db>) -> AppResult<AiStatus> {
    Ok(AiStatus {
        consented: consented(&db)?,
        has_key: secrets::get_key()?.is_some(),
    })
}

/// Agree to (or withdraw from) the consent screen. Withdrawing also forgets the key.
#[tauri::command]
pub fn ai_consent(db: State<'_, Db>, given: bool) -> AppResult<()> {
    if !given {
        secrets::clear_key()?;
    }
    with_conn(&db, |conn| app_settings::set_ai_consent(conn, given))
}

/// Checks the key with Google first, then keeps it in the OS keychain.
#[tauri::command]
pub async fn ai_set_key(db: State<'_, Db>, key: String) -> AppResult<()> {
    if !consented(&db)? {
        return Err(AppError::Ai("off"));
    }
    let key = key.trim().to_owned();
    if key.is_empty() || key.len() > KEY_MAX || key.chars().any(char::is_whitespace) {
        return Err(AppError::Ai("badKey"));
    }
    Gemini::new(key.clone())?.check_key().await?;
    secrets::set_key(&key)
}

#[tauri::command]
pub fn ai_clear_key() -> AppResult<()> {
    secrets::clear_key()
}

/// A2: read a sentence the offline parser was unsure about. `now` = local `YYYY-MM-DDTHH:mm`.
#[tauri::command]
pub async fn ai_parse_text(db: State<'_, Db>, text: String, now: String) -> AppResult<AiDraft> {
    let gemini = provider(&db)?;
    parse::read_sentence(&gemini, &text, &now).await
}

/// Opens Google AI Studio's key page in the browser.
#[tauri::command]
pub fn ai_open_key_page(app: AppHandle) -> AppResult<()> {
    app.opener()
        .open_url(KEY_PAGE, None::<&str>)
        .map_err(|_| AppError::Ai("failed"))
}
