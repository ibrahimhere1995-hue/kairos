//! Inbox (PRD R18, P3-T01): quick notes and pictures without a date, each turned into a task
//! with one click. Voice notes come with P3-T14.

use std::fs;
use std::path::Path;

use rusqlite::Connection;
use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::i18n::t;
use crate::models::attachment::Attachment;
use crate::models::inputs::ItemInput;
use crate::models::item::{Item, ItemKind, ItemSource};
use crate::repo::{attachments, inbox as repo};
use crate::services::items;
use crate::util::{new_id, now_utc};

pub const TEXT_MAX: usize = 5000;
pub const IMAGE_MAX_BYTES: usize = 20 * 1024 * 1024;
const IMAGE_TYPES: [(&str, &str); 5] = [
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("gif", "image/gif"),
    ("webp", "image/webp"),
];

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct InboxEntry {
    pub id: String,
    pub text: Option<String>,
    pub has_image: bool,
    pub created_at: String,
}

fn mime_of(ext: &str) -> Option<&'static str> {
    IMAGE_TYPES.iter().find(|(e, _)| *e == ext).map(|(_, m)| *m)
}

fn clean_text(text: Option<&str>) -> AppResult<Option<String>> {
    let text = text.map(str::trim).filter(|s| !s.is_empty());
    if text.is_some_and(|s| s.chars().count() > TEXT_MAX) {
        return Err(AppError::invalid("text", "tooLong"));
    }
    Ok(text.map(str::to_owned))
}

fn insert(
    conn: &Connection,
    text: Option<String>,
    image_path: Option<&str>,
) -> AppResult<InboxEntry> {
    let entry = InboxEntry {
        id: new_id(),
        has_image: image_path.is_some(),
        text,
        created_at: now_utc(),
    };
    repo::insert(conn, &entry, image_path)?;
    Ok(entry)
}

/// Entries still waiting to be dealt with, newest first.
pub fn list(conn: &Connection) -> AppResult<Vec<InboxEntry>> {
    Ok(repo::list_pending(conn)?)
}

pub fn add_text(conn: &Connection, text: &str) -> AppResult<InboxEntry> {
    let text = clean_text(Some(text))?.ok_or(AppError::invalid("text", "required"))?;
    insert(conn, Some(text), None)
}

/// A pasted picture (raw bytes). `ext` is the image type, e.g. `png`.
pub fn add_image(
    conn: &Connection,
    dir: &Path,
    bytes: &[u8],
    ext: &str,
    text: Option<&str>,
) -> AppResult<InboxEntry> {
    let ext = ext.to_ascii_lowercase();
    mime_of(&ext).ok_or(AppError::invalid("image", "outOfRange"))?;
    if bytes.is_empty() || bytes.len() > IMAGE_MAX_BYTES {
        return Err(AppError::invalid("attachments", "fileTooLarge"));
    }
    let text = clean_text(text)?;
    let rel_path = format!("{}.{ext}", new_id());
    fs::create_dir_all(dir).map_err(|_| AppError::invalid("attachments", "copyFailed"))?;
    fs::write(dir.join(&rel_path), bytes)
        .map_err(|_| AppError::invalid("attachments", "copyFailed"))?;
    insert(conn, text, Some(&rel_path))
}

/// A picture chosen with the file picker.
pub fn add_image_file(conn: &Connection, dir: &Path, path: &Path) -> AppResult<InboxEntry> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let bytes = fs::read(path).map_err(|_| AppError::invalid("attachments", "fileNotFound"))?;
    add_image(conn, dir, &bytes, &ext, None)
}

fn image_path(conn: &Connection, id: &str) -> AppResult<Option<String>> {
    Ok(repo::content(conn, id, false)?.ok_or(AppError::NotFound)?.1)
}

/// A `data:` URL of the entry's picture, for the preview.
pub fn image_data_url(conn: &Connection, dir: &Path, id: &str) -> AppResult<String> {
    let rel = image_path(conn, id)?.ok_or(AppError::NotFound)?;
    let ext = rel.rsplit('.').next().unwrap_or("");
    let mime = mime_of(ext).ok_or(AppError::NotFound)?;
    let bytes = fs::read(dir.join(&rel)).map_err(|_| AppError::NotFound)?;
    Ok(format!("data:{mime};base64,{}", base64(&bytes)))
}

/// "Make it a task": a task without a date (first line = title, the rest = notes), with the
/// picture attached. The entry leaves the Inbox list.
pub fn process(conn: &mut Connection, dir: &Path, id: &str) -> AppResult<Item> {
    let (text, rel) = repo::content(conn, id, true)?.ok_or(AppError::NotFound)?;
    let body = text.unwrap_or_default();
    let mut lines = body.lines();
    let first = lines.next().unwrap_or("").trim();
    let rest = lines.collect::<Vec<_>>().join("\n").trim().to_owned();
    let title: String = if first.is_empty() {
        t("inbox.pictureTitle", &[])
    } else {
        first.chars().take(200).collect()
    };
    let item = items::create(
        conn,
        &ItemInput {
            kind: ItemKind::Task,
            title,
            notes: (!rest.is_empty()).then_some(rest),
            area_id: None,
            priority: 0,
            start_at: None,
            end_at: None,
            due_date: None,
            location: None,
            source: Some(ItemSource::Quick),
            reminders: None,
            rrule: None,
            milestone_id: None,
        },
    )?;
    let tx = conn.transaction()?;
    let mut attachment_id: Option<String> = None;
    if let Some(rel) = &rel {
        let ext = rel.rsplit('.').next().unwrap_or("");
        let size = fs::metadata(dir.join(rel)).map(|m| m.len()).unwrap_or(0);
        let a = Attachment {
            id: new_id(),
            item_id: item.id.clone(),
            file_name: format!("{}.{ext}", t("inbox.pictureTitle", &[])),
            mime: mime_of(ext)
                .unwrap_or("application/octet-stream")
                .to_owned(),
            size_bytes: i64::try_from(size).unwrap_or(0),
            created_at: now_utc(),
        };
        attachments::insert(&tx, &a, rel)?;
        attachment_id = Some(a.id);
    }
    repo::mark_processed(&tx, id, &item.id, attachment_id.as_deref(), &now_utc())?;
    tx.commit()?;
    Ok(item)
}

/// Soft delete (Undo restores). The picture file stays, like attachments.
pub fn set_deleted(conn: &Connection, id: &str, deleted: bool) -> AppResult<()> {
    let now = now_utc();
    let changed = repo::set_deleted(conn, id, deleted.then_some(now.as_str()), &now)?;
    if changed == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

fn base64(bytes: &[u8]) -> String {
    const ABC: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        for (i, shift) in [18, 12, 6, 0].into_iter().enumerate() {
            if i <= chunk.len() {
                out.push(char::from(ABC[((n >> shift) & 63) as usize]));
            } else {
                out.push('=');
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::{migrated_conn, scratch_path};

    #[test]
    fn base64_matches_the_standard() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn text_notes_become_tasks() {
        let mut c = migrated_conn();
        let dir = scratch_path("inbox");
        assert!(add_text(&c, "   ").is_err());
        let e = add_text(&c, "Call the plumber\nabout the kitchen tap").unwrap();
        assert_eq!(list(&c).unwrap().len(), 1);
        let item = process(&mut c, &dir, &e.id).unwrap();
        assert_eq!(item.title, "Call the plumber");
        assert_eq!(item.notes.as_deref(), Some("about the kitchen tap"));
        assert_eq!(item.due_date, None, "lands in the Inbox tasks, no date");
        assert!(list(&c).unwrap().is_empty());
        assert!(process(&mut c, &dir, &e.id).is_err(), "only once");
    }

    #[test]
    fn pictures_are_kept_previewed_and_attached() {
        let mut c = migrated_conn();
        let dir = scratch_path("inbox");
        assert!(add_image(&c, &dir, b"x", "exe", None).is_err());
        let e = add_image(&c, &dir, b"\x89PNG", "PNG", None).unwrap();
        assert!(e.has_image);
        assert!(
            image_data_url(&c, &dir, &e.id)
                .unwrap()
                .starts_with("data:image/png;base64,iVBORw")
        );
        let item = process(&mut c, &dir, &e.id).unwrap();
        assert!(!item.title.is_empty() && !item.title.starts_with("inbox."));
        let files = crate::services::attachments::list(&c, &item.id).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].mime, "image/png");
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn delete_and_undo() {
        let c = migrated_conn();
        let e = add_text(&c, "Idea").unwrap();
        set_deleted(&c, &e.id, true).unwrap();
        assert!(list(&c).unwrap().is_empty());
        set_deleted(&c, &e.id, false).unwrap();
        assert_eq!(list(&c).unwrap().len(), 1);
    }
}
