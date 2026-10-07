use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

/// Every command returns `Result<T, AppError>` (ARCHITECTURE §7).
/// Details stay in Rust; the frontend only receives a stable `code` and an i18n `message` key.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("migration error: {0}")]
    Migration(#[from] rusqlite_migration::Error),
    #[error("file error: {0}")]
    Io(#[from] std::io::Error),
    #[error("the app data folder could not be found")]
    DataDir,
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Database(_) => "database",
            AppError::Migration(_) => "migration",
            AppError::Io(_) => "io",
            AppError::DataDir => "data_dir",
        }
    }

    pub fn message_key(&self) -> &'static str {
        match self {
            AppError::Database(_) | AppError::Migration(_) => "errors.database",
            AppError::Io(_) => "errors.file",
            AppError::DataDir => "errors.dataDir",
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", self.message_key())?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_without_leaking_internal_details() {
        let err = AppError::Io(std::io::Error::other("C:\\secret\\path"));
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, r#"{"code":"io","message":"errors.file"}"#);
    }
}
