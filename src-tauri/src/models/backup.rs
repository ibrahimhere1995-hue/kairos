use serde::{Deserialize, Serialize};

/// Where a backup file lives: Kairos's own backups folder, or the user's chosen extra folder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum BackupLocation {
    App,
    Folder,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum BackupKind {
    Automatic,
    Manual,
    /// Made automatically before a restore, an update of the data format, or emptying the Trash.
    Safety,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct BackupInfo {
    pub file_name: String,
    pub location: BackupLocation,
    pub kind: BackupKind,
    /// UTC ISO-8601.
    pub created_at: String,
    pub size_bytes: i64,
    /// Items in the backup, or None if it could not be read.
    pub item_count: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct BackupSettings {
    /// Extra folder (e.g. a OneDrive/Dropbox folder or USB drive), if chosen.
    pub folder: Option<String>,
    pub last_backup_at: Option<String>,
    /// Set when the most recent backup attempt failed (e.g. the disk is full).
    pub last_failure_at: Option<String>,
}

/// Shown once after startup if Kairos had to repair its data (P1-T15).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum StartupNotice {
    /// The data file was damaged; the latest good backup was restored.
    #[serde(rename_all = "camelCase")]
    Restored {
        backup_created_at: String,
        kept_at: String,
    },
    /// The data file was damaged and no good backup existed; Kairos started fresh.
    #[serde(rename_all = "camelCase")]
    Unrecoverable { kept_at: String },
}
