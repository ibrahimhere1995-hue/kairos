//! The Gemini key, in the OS keychain (Windows Credential Manager, macOS Keychain) only —
//! never in the database, logs or exports (PROJECT_RULES #4).

use keyring::{Entry, Error};

use crate::error::{AppError, AppResult};

/// Development builds use their own entry, so testing never touches the real key.
const SERVICE: &str = if cfg!(debug_assertions) {
    "Kairos (dev)"
} else {
    "Kairos"
};
const ACCOUNT: &str = "gemini-api-key";

fn entry() -> AppResult<Entry> {
    Entry::new(SERVICE, ACCOUNT).map_err(|_| AppError::Ai("keychain"))
}

pub fn get_key() -> AppResult<Option<String>> {
    match entry()?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(Error::NoEntry) => Ok(None),
        Err(_) => Err(AppError::Ai("keychain")),
    }
}

pub fn set_key(key: &str) -> AppResult<()> {
    entry()?
        .set_password(key)
        .map_err(|_| AppError::Ai("keychain"))
}

pub fn clear_key() -> AppResult<()> {
    match entry()?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(_) => Err(AppError::Ai("keychain")),
    }
}
