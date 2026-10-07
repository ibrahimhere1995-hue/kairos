use serde::{Serialize, Serializer};

/// Every command returns `Result<T, AppError>` (ARCHITECTURE §7).
/// Details stay in Rust; the frontend only receives an [`ErrorPayload`].
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
    #[error("invalid {field}: {reason}")]
    Validation {
        field: &'static str,
        reason: &'static str,
    },
    #[error("item not found")]
    NotFound,
    #[error("the database is unavailable (lock poisoned)")]
    Lock,
}

impl AppError {
    pub fn invalid(field: &'static str, reason: &'static str) -> Self {
        AppError::Validation { field, reason }
    }

    pub fn code(&self) -> &'static str {
        match self {
            AppError::Database(_) => "database",
            AppError::Migration(_) => "migration",
            AppError::Io(_) => "io",
            AppError::DataDir => "data_dir",
            AppError::Validation { .. } => "validation",
            AppError::NotFound => "not_found",
            AppError::Lock => "lock",
        }
    }

    /// i18n key the frontend shows (`src/i18n/locales/en.json` → `errors.*`).
    pub fn message_key(&self) -> String {
        match self {
            AppError::Database(_) | AppError::Migration(_) | AppError::Lock => {
                "errors.database".into()
            }
            AppError::Io(_) => "errors.file".into(),
            AppError::DataDir => "errors.dataDir".into(),
            AppError::Validation { reason, .. } => format!("errors.validation.{reason}"),
            AppError::NotFound => "errors.notFound".into(),
        }
    }

    pub fn payload(&self) -> ErrorPayload {
        ErrorPayload {
            code: self.code().into(),
            message: self.message_key(),
            field: match self {
                AppError::Validation { field, .. } => Some((*field).into()),
                _ => None,
            },
        }
    }
}

/// What a failed command sends to the frontend: stable code, i18n key, and the
/// offending field for validation errors. Never paths, SQL, or user data.
#[derive(Debug, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
    pub field: Option<String>,
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.payload().serialize(serializer)
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
        assert_eq!(
            json,
            r#"{"code":"io","message":"errors.file","field":null}"#
        );
    }

    #[test]
    fn validation_errors_name_the_field_and_reason() {
        let json = serde_json::to_string(&AppError::invalid("title", "required")).unwrap();
        assert_eq!(
            json,
            r#"{"code":"validation","message":"errors.validation.required","field":"title"}"#
        );
    }
}
