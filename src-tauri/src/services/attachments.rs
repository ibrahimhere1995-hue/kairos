//! Attachments (PRD R1, P2-T11): files copied into Kairos' own folder, listed on the item,
//! opened with the system's usual app. Files are never changed or deleted by Kairos, so
//! backups (which copy them) and restores always find them.

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::attachment::Attachment;
use crate::repo::{attachments as repo, items};
use crate::util::{new_id, now_utc};

/// Largest file Kairos copies in (keeps backups and the disk sensible).
pub const MAX_BYTES: u64 = 100 * 1024 * 1024;
pub const MAX_PER_ITEM: i64 = 20;
const BACKUP_SUBDIR: &str = "attachments";

/// Who owns attachments for `item_id`: like steps, a repeating item's occurrences share
/// the series' attachments.
fn owner_of(conn: &Connection, item_id: &str) -> AppResult<String> {
    let id = match crate::scheduler::recurrence::split_occurrence_id(item_id) {
        Some((series, _)) => series.to_owned(),
        None => items::get(conn, item_id)?
            .and_then(|item| item.recurrence_parent_id)
            .unwrap_or_else(|| item_id.to_owned()),
    };
    match items::get(conn, &id)? {
        Some(item) if item.deleted_at.is_none() => Ok(id),
        _ => Err(AppError::NotFound),
    }
}

/// A short, safe file extension (letters and digits only), or none.
fn extension(path: &Path) -> Option<String> {
    let ext = path.extension()?.to_str()?.to_ascii_lowercase();
    (!ext.is_empty() && ext.len() <= 10 && ext.chars().all(|c| c.is_ascii_alphanumeric()))
        .then_some(ext)
}

fn mime_for(ext: Option<&str>) -> &'static str {
    match ext.unwrap_or("") {
        "pdf" => "application/pdf",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "heic" => "image/heic",
        "txt" => "text/plain",
        "csv" => "text/csv",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" | "pptx" => "application/vnd.ms-powerpoint",
        "zip" => "application/zip",
        "ics" => "text/calendar",
        _ => "application/octet-stream",
    }
}

pub fn list(conn: &Connection, item_id: &str) -> AppResult<Vec<Attachment>> {
    Ok(repo::list_for_item(conn, &owner_of(conn, item_id)?)?)
}

/// Copies `source` into the attachments folder and records it on the item.
pub fn add(
    conn: &Connection,
    attachments_dir: &Path,
    item_id: &str,
    source: &Path,
) -> AppResult<Attachment> {
    let owner = owner_of(conn, item_id)?;
    if repo::count_for_item(conn, &owner)? >= MAX_PER_ITEM {
        return Err(AppError::invalid("attachments", "tooMany"));
    }
    let meta =
        fs::metadata(source).map_err(|_| AppError::invalid("attachments", "fileNotFound"))?;
    if !meta.is_file() {
        return Err(AppError::invalid("attachments", "fileNotFound"));
    }
    if meta.len() > MAX_BYTES {
        return Err(AppError::invalid("attachments", "fileTooLarge"));
    }
    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .map(str::to_owned)
        .ok_or_else(|| AppError::invalid("attachments", "fileNotFound"))?;

    let id = new_id();
    let ext = extension(source);
    let rel_path = match &ext {
        Some(ext) => format!("{id}.{ext}"),
        None => id.clone(),
    };
    fs::create_dir_all(attachments_dir)
        .map_err(|_| AppError::invalid("attachments", "copyFailed"))?;
    let target = attachments_dir.join(&rel_path);
    fs::copy(source, &target).map_err(|_| AppError::invalid("attachments", "copyFailed"))?;

    let attachment = Attachment {
        id,
        item_id: owner,
        file_name,
        mime: mime_for(ext.as_deref()).to_owned(),
        size_bytes: i64::try_from(meta.len()).unwrap_or(i64::MAX),
        created_at: now_utc(),
    };
    if let Err(error) = repo::insert(conn, &attachment, &rel_path) {
        // Don't leave a copy nobody refers to.
        let _ = fs::remove_file(&target);
        return Err(error.into());
    }
    Ok(attachment)
}

/// Takes an attachment off its item. The file stays (a backup may be restored later).
pub fn remove(conn: &Connection, id: &str) -> AppResult<()> {
    if repo::soft_delete(conn, id, &now_utc())? == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// The file of an attachment, checked to be inside the attachments folder.
pub fn file_of(conn: &Connection, attachments_dir: &Path, id: &str) -> AppResult<PathBuf> {
    let (_, rel_path) = repo::get(conn, id)?.ok_or(AppError::NotFound)?;
    let safe = Path::new(&rel_path)
        .file_name()
        .is_some_and(|name| name == rel_path.as_str());
    let path = attachments_dir.join(&rel_path);
    if !safe || !path.is_file() {
        return Err(AppError::NotFound);
    }
    Ok(path)
}

/// Backups: copies attachment files the backup folder doesn't have yet (they never change,
/// so a name match means the same file). Returns how many were copied.
pub fn mirror_to(attachments_dir: &Path, backup_dir: &Path) -> std::io::Result<usize> {
    let Ok(entries) = fs::read_dir(attachments_dir) else {
        return Ok(0);
    };
    let target_dir = backup_dir.join(BACKUP_SUBDIR);
    fs::create_dir_all(&target_dir)?;
    let mut copied = 0;
    for entry in entries.flatten() {
        let target = target_dir.join(entry.file_name());
        if entry.path().is_file() && !target.exists() {
            fs::copy(entry.path(), target)?;
            copied += 1;
        }
    }
    Ok(copied)
}

/// After a restore: brings back any file the restored data refers to but this computer no
/// longer has, from the backup folders' copies.
pub fn restore_missing(
    conn: &Connection,
    attachments_dir: &Path,
    backup_dirs: &[PathBuf],
) -> AppResult<usize> {
    let mut restored = 0;
    for rel_path in repo::all_rel_paths(conn)? {
        let target = attachments_dir.join(&rel_path);
        if target.exists()
            || Path::new(&rel_path)
                .file_name()
                .is_none_or(|n| n != rel_path.as_str())
        {
            continue;
        }
        let found = backup_dirs
            .iter()
            .map(|dir| dir.join(BACKUP_SUBDIR).join(&rel_path))
            .find(|p| p.is_file());
        if let Some(source) = found {
            fs::create_dir_all(attachments_dir).ok();
            if fs::copy(source, &target).is_ok() {
                restored += 1;
            }
        }
    }
    Ok(restored)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::{migrated_conn, scratch_path};
    use crate::models::inputs::ItemInput;
    use crate::models::item::ItemKind;
    use crate::services::items as item_service;

    fn task(c: &mut Connection, rrule: Option<&str>) -> String {
        item_service::create(
            c,
            &ItemInput {
                kind: ItemKind::Task,
                title: "Pay invoice".into(),
                notes: None,
                area_id: None,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: Some("2030-01-07".into()),
                location: None,
                source: None,
                reminders: Some(vec![]),
                rrule: rrule.map(Into::into),
            },
        )
        .unwrap()
        .id
    }

    fn file(dir: &Path, name: &str, body: &[u8]) -> PathBuf {
        fs::create_dir_all(dir).unwrap();
        let path = dir.join(name);
        fs::write(&path, body).unwrap();
        path
    }

    #[test]
    fn copies_a_file_in_and_finds_it_again() {
        let mut c = migrated_conn();
        let root = scratch_path("att");
        let item = task(&mut c, None);
        let source = file(&root.join("outside"), "Invoice March.PDF", b"%PDF-1.4");
        let store = root.join("attachments");

        let added = add(&c, &store, &item, &source).unwrap();
        assert_eq!(added.file_name, "Invoice March.PDF");
        assert_eq!(added.mime, "application/pdf");
        assert_eq!(added.size_bytes, 8);
        let stored = file_of(&c, &store, &added.id).unwrap();
        assert!(stored.starts_with(&store));
        assert_eq!(fs::read(&stored).unwrap(), b"%PDF-1.4");
        assert_eq!(list(&c, &item).unwrap().len(), 1);

        remove(&c, &added.id).unwrap();
        assert!(list(&c, &item).unwrap().is_empty());
        assert!(stored.exists(), "the file stays for backups");
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn refuses_missing_files_folders_and_unknown_items() {
        let mut c = migrated_conn();
        let root = scratch_path("att");
        let item = task(&mut c, None);
        let store = root.join("attachments");
        assert!(add(&c, &store, &item, &root.join("nope.pdf")).is_err());
        fs::create_dir_all(root.join("folder")).unwrap();
        assert!(add(&c, &store, &item, &root.join("folder")).is_err());
        let source = file(&root, "a.txt", b"x");
        assert!(matches!(
            add(&c, &store, "missing", &source),
            Err(AppError::NotFound)
        ));
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn occurrences_share_the_series_attachments() {
        let mut c = migrated_conn();
        let root = scratch_path("att");
        let first = task(&mut c, Some("FREQ=WEEKLY"));
        let series = first.split('@').next().unwrap().to_owned();
        let source = file(&root, "plan.png", b"png");
        let store = root.join("attachments");
        let added = add(&c, &store, &first, &source).unwrap();
        assert_eq!(added.item_id, series);
        assert_eq!(list(&c, &format!("{series}@2030-01-14")).unwrap().len(), 1);
        fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn backups_copy_files_and_restores_bring_them_back() {
        let mut c = migrated_conn();
        let root = scratch_path("att");
        let item = task(&mut c, None);
        let store = root.join("attachments");
        let backups = root.join("backups");
        let added = add(&c, &store, &item, &file(&root, "scan.jpg", b"jpg")).unwrap();

        assert_eq!(mirror_to(&store, &backups).unwrap(), 1);
        assert_eq!(
            mirror_to(&store, &backups).unwrap(),
            0,
            "only new files are copied"
        );

        let stored = file_of(&c, &store, &added.id).unwrap();
        fs::remove_file(&stored).unwrap();
        assert_eq!(
            restore_missing(&c, &store, std::slice::from_ref(&backups)).unwrap(),
            1
        );
        assert_eq!(fs::read(&stored).unwrap(), b"jpg");
        fs::remove_dir_all(&root).ok();
    }
}
