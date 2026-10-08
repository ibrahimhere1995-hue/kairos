//! Backups (PRD R5, P1-T14): automatic every 24 h and on close, "Back up now", verification,
//! retention, an optional extra folder, and restore (current data saved first).

use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::Connection;
use rusqlite::backup::Backup;

use crate::backup::{self, naming, retention};
use crate::db::{Db, migrations};
use crate::error::{AppError, AppResult};
use crate::models::backup::{BackupInfo, BackupKind, BackupLocation, BackupSettings};
use crate::paths::AppPaths;
use crate::repo::{backup_log, settings};
use crate::util::{new_id, now_utc};

const FOLDER_KEY: &str = "backup.folder";
const LAST_AUTO_KEY: &str = "backup.lastAuto";
pub const AUTO_INTERVAL: chrono::Duration = chrono::Duration::hours(24);

fn lock(db: &Db) -> AppResult<std::sync::MutexGuard<'_, Connection>> {
    db.0.lock().map_err(|_| AppError::Lock)
}

fn kind_of(label: &str) -> BackupKind {
    match label {
        naming::LABEL_AUTO => BackupKind::Automatic,
        naming::LABEL_MANUAL => BackupKind::Manual,
        _ => BackupKind::Safety,
    }
}

pub fn folder(conn: &Connection) -> AppResult<Option<PathBuf>> {
    let stored = settings::get(conn, FOLDER_KEY)?;
    Ok(stored
        .and_then(|json| serde_json::from_str::<Option<String>>(&json).ok().flatten())
        .map(PathBuf::from))
}

pub fn get_settings(conn: &Connection) -> AppResult<BackupSettings> {
    let last_ok = backup_log::latest(conn, true)?;
    let last_failed = backup_log::latest(conn, false)?;
    // Only report a failure that happened after the last success.
    let last_failure_at = match (&last_failed, &last_ok) {
        (Some(failed), Some(ok)) if failed <= ok => None,
        _ => last_failed,
    };
    Ok(BackupSettings {
        folder: folder(conn)?.map(|p| p.display().to_string()),
        last_backup_at: last_ok,
        last_failure_at,
    })
}

/// Sets (or clears, with None) the extra backup folder after checking Kairos can write there.
pub fn set_folder(conn: &Connection, folder: Option<&str>) -> AppResult<BackupSettings> {
    let value = match folder.map(str::trim).filter(|f| !f.is_empty()) {
        None => None,
        Some(f) => {
            let path = Path::new(f);
            if !path.is_absolute() {
                return Err(AppError::invalid("folder", "folderNotAbsolute"));
            }
            let probe = path.join(".kairos-write-test");
            let writable = std::fs::create_dir_all(path)
                .and_then(|()| std::fs::write(&probe, b"ok"))
                .and_then(|()| std::fs::remove_file(&probe));
            if writable.is_err() {
                return Err(AppError::invalid("folder", "folderNotWritable"));
            }
            Some(f.to_owned())
        }
    };
    let json = serde_json::to_string(&value)
        .map_err(|_| AppError::invalid("folder", "folderNotWritable"))?;
    settings::set(conn, FOLDER_KEY, &json)?;
    get_settings(conn)
}

fn info_for(path: &Path, location: BackupLocation) -> Option<BackupInfo> {
    let name = path.file_name()?.to_str()?.to_owned();
    let parsed = naming::parse(&name)?;
    let size_bytes = std::fs::metadata(path)
        .ok()
        .and_then(|m| i64::try_from(m.len()).ok())?;
    Some(BackupInfo {
        file_name: name,
        location,
        kind: kind_of(&parsed.label),
        created_at: parsed
            .created_at
            .to_rfc3339_opts(SecondsFormat::Millis, true),
        size_bytes,
        item_count: backup::verify(path).ok(),
    })
}

fn backups_in(dir: &Path) -> Vec<(PathBuf, naming::ParsedName)> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .filter_map(|e| {
            let path = e.path();
            let parsed = naming::parse(path.file_name()?.to_str()?)?;
            Some((path, parsed))
        })
        .collect()
}

/// Deletes backups beyond the retention rules. Best effort: a file that can't be removed stays.
pub fn apply_retention(dir: &Path) {
    let all = backups_in(dir);
    let as_pairs = |label: &str| -> Vec<(String, DateTime<Utc>)> {
        all.iter()
            .filter(|(_, p)| p.label == label)
            .filter_map(|(path, p)| Some((path.file_name()?.to_str()?.to_owned(), p.created_at)))
            .collect()
    };
    let mut doomed = retention::automatic_to_delete(&as_pairs(naming::LABEL_AUTO));
    for label in [
        naming::LABEL_PRE_RESTORE,
        naming::LABEL_PRE_MIGRATION,
        naming::LABEL_PRE_PURGE,
    ] {
        doomed.extend(retention::safety_to_delete(&as_pairs(label)));
    }
    for name in doomed {
        let _ = std::fs::remove_file(dir.join(name));
    }
}

/// Makes, verifies and logs a backup; copies it to the extra folder if one is set.
/// The copy itself uses its own read-only connection, so the app stays responsive.
pub fn backup_now(db: &Db, paths: &AppPaths, label: &str) -> AppResult<BackupInfo> {
    let made = backup::backup_db_file(&paths.db_path, &paths.backups_dir, label).and_then(|path| {
        let count = backup::verify(&path)?;
        Ok((path, count))
    });

    let now = now_utc();
    let conn = lock(db)?;
    let (path, count) = match made {
        Ok(made) => made,
        Err(error) => {
            // e.g. disk full (PRD story 10): record it so Settings can explain what to do.
            backup_log::insert(
                &conn,
                &backup_log::LogEntry {
                    id: &new_id(),
                    path: &paths.backups_dir.display().to_string(),
                    kind: label,
                    size_bytes: None,
                    item_count: None,
                    ok: false,
                    error: Some(error.code()),
                    created_at: &now,
                },
            )?;
            return Err(error);
        }
    };

    let folder = folder(&conn)?;
    let copy_error = folder.as_ref().and_then(|dir| {
        let name = path.file_name()?;
        std::fs::create_dir_all(dir)
            .and_then(|()| std::fs::copy(&path, dir.join(name)))
            .err()
            .map(|_| "folder_copy_failed")
    });
    let size = std::fs::metadata(&path)
        .ok()
        .and_then(|m| i64::try_from(m.len()).ok());
    backup_log::insert(
        &conn,
        &backup_log::LogEntry {
            id: &new_id(),
            path: &path.display().to_string(),
            kind: label,
            size_bytes: size,
            item_count: Some(count),
            ok: true,
            error: copy_error,
            created_at: &now,
        },
    )?;
    if label == naming::LABEL_AUTO {
        settings::set(
            &conn,
            LAST_AUTO_KEY,
            &serde_json::Value::String(now.clone()).to_string(),
        )?;
    }
    drop(conn);

    apply_retention(&paths.backups_dir);
    if let Some(dir) = &folder {
        apply_retention(dir);
    }
    info_for(&path, BackupLocation::App).ok_or(AppError::InvalidBackup)
}

/// Backups in Kairos's folder and the extra folder, newest first.
pub fn list(db: &Db, paths: &AppPaths) -> AppResult<Vec<BackupInfo>> {
    let folder = folder(&*lock(db)?)?;
    let mut infos: Vec<BackupInfo> = backups_in(&paths.backups_dir)
        .into_iter()
        .filter_map(|(path, _)| info_for(&path, BackupLocation::App))
        .collect();
    if let Some(dir) = folder {
        infos.extend(
            backups_in(&dir)
                .into_iter()
                .filter_map(|(path, _)| info_for(&path, BackupLocation::Folder)),
        );
    }
    infos.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(infos)
}

/// Replaces the current data with a backup. The current data is backed up first, and the
/// restored copy is brought up to the current data format.
pub fn restore(
    db: &Db,
    paths: &AppPaths,
    location: BackupLocation,
    file_name: &str,
) -> AppResult<()> {
    naming::parse(file_name).ok_or(AppError::InvalidBackup)?;
    let dir = match location {
        BackupLocation::App => paths.backups_dir.clone(),
        BackupLocation::Folder => folder(&*lock(db)?)?.ok_or(AppError::NotFound)?,
    };
    let source_path = dir.join(file_name);
    if !source_path.is_file() {
        return Err(AppError::NotFound);
    }
    backup::verify(&source_path)?;

    backup_now(db, paths, naming::LABEL_PRE_RESTORE)?;

    let mut live = lock(db)?;
    let source = backup::open_read_only(&source_path)?;
    Backup::new(&source, &mut live)?.run_to_completion(256, Duration::from_millis(0), None)?;
    migrations::migrate(&mut live, &paths.backups_dir)?;
    Ok(())
}

/// True when the last automatic backup is 24 hours old or there has never been one.
pub fn is_auto_due(conn: &Connection, now: DateTime<Utc>) -> AppResult<bool> {
    let last = settings::get(conn, LAST_AUTO_KEY)?
        .and_then(|json| serde_json::from_str::<String>(&json).ok())
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok());
    Ok(last.is_none_or(|last| now - last.to_utc() >= AUTO_INTERVAL))
}

#[cfg(test)]
#[path = "backups_tests.rs"]
mod tests;
