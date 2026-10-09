//! Your data, in and out (PRD R5, P2-T12): export everything as JSON, export a calendar
//! (`.ics`), import a calendar (`.ics`, one-way: PRD §3). The command layer makes a
//! "pre-import" backup before importing.

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use chrono::{Local, Utc};
use rusqlite::Connection;
use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::models::area::Area;
use crate::models::attachment::Attachment;
use crate::models::checklist::ChecklistItem;
use crate::models::inputs::ItemInput;
use crate::models::item::{Item, ItemSource};
use crate::models::settings::AppSettings;
use crate::repo::{areas, export as repo};
use crate::services::{app_settings, ics, items};

/// Largest calendar file read (a year of a busy calendar is well under 5 MB).
pub const MAX_IMPORT_BYTES: u64 = 20 * 1024 * 1024;
const FORMAT_VERSION: u32 = 1;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct JsonExport {
    app: &'static str,
    format_version: u32,
    exported_at: String,
    settings: AppSettings,
    areas: Vec<Area>,
    items: Vec<Item>,
    steps: Vec<ChecklistItem>,
    reminders: Vec<repo::ExportedReminder>,
    /// File details only; the files themselves are in Kairos' attachments folder.
    attachments: Vec<Attachment>,
}

pub(crate) fn write_file(path: &Path, text: &str) -> AppResult<()> {
    if !path.is_absolute() {
        return Err(AppError::invalid("path", "folderNotAbsolute"));
    }
    fs::write(path, text).map_err(|_| AppError::invalid("path", "folderNotWritable"))
}

/// Everything (except secrets and the Trash) as one readable JSON file.
pub fn export_json(conn: &Connection, path: &Path) -> AppResult<()> {
    let export = JsonExport {
        app: "Kairos",
        format_version: FORMAT_VERSION,
        exported_at: crate::util::now_utc(),
        settings: app_settings::get(conn)?,
        areas: areas::list_all(conn)?,
        items: repo::all_items(conn)?,
        steps: repo::all_steps(conn)?,
        reminders: repo::all_reminders(conn)?,
        attachments: repo::all_attachments(conn)?,
    };
    let text = serde_json::to_string_pretty(&export)
        .map_err(|_| AppError::invalid("path", "outOfRange"))?;
    write_file(path, &text)
}

/// Tasks and events with a date, as a calendar file other apps can open. Returns how many.
pub fn export_ics(conn: &Connection, path: &Path) -> AppResult<usize> {
    let all = repo::all_items(conn)?;
    let mut stored: HashMap<String, Vec<String>> = HashMap::new();
    for item in &all {
        if let (Some(parent), Some(key)) = (&item.recurrence_parent_id, &item.original_start_at) {
            stored.entry(parent.clone()).or_default().push(key.clone());
        }
    }
    let entries: Vec<(Item, Vec<String>)> = all
        .into_iter()
        .filter(|i| i.start_at.is_some() || i.due_date.is_some())
        .map(|i| {
            let exdates = stored.get(&i.id).cloned().unwrap_or_default();
            (i, exdates)
        })
        .collect();
    write_file(path, &ics::write_calendar(&Local, &entries, Utc::now()))?;
    Ok(entries.len())
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct ImportSummary {
    pub imported: usize,
    /// Already in Kairos (same title at the same moment).
    pub duplicates: usize,
    /// Things Kairos can't represent (cancelled entries, changed single occurrences…).
    pub skipped: usize,
    /// Imported without their repeat (a repeat Kairos doesn't support).
    pub simplified: usize,
}

/// Reads a calendar file and adds its events and tasks (no reminders, so a big import is
/// silent). Make a backup first: the command does.
pub fn import_ics(conn: &mut Connection, path: &Path) -> AppResult<ImportSummary> {
    let meta = fs::metadata(path).map_err(|_| AppError::invalid("path", "fileNotFound"))?;
    if meta.len() > MAX_IMPORT_BYTES {
        return Err(AppError::invalid("path", "fileTooLarge"));
    }
    let bytes = fs::read(path).map_err(|_| AppError::invalid("path", "fileNotFound"))?;
    let content = String::from_utf8_lossy(&bytes);
    let read =
        ics::read(&Local, &content).map_err(|_| AppError::invalid("path", "notACalendar"))?;

    let mut summary = ImportSummary {
        imported: 0,
        duplicates: 0,
        skipped: read.skipped,
        simplified: read.simplified,
    };
    for entry in read.entries {
        if repo::exists_like(
            conn,
            &entry.title,
            entry.start_at.as_deref(),
            entry.due_date.as_deref(),
        )? {
            summary.duplicates += 1;
            continue;
        }
        let input = ItemInput {
            kind: entry.kind,
            title: entry.title,
            notes: entry.notes,
            area_id: None,
            priority: 0,
            start_at: entry.start_at,
            end_at: entry.end_at,
            due_date: entry.due_date,
            location: entry.location,
            source: Some(ItemSource::Import),
            reminders: Some(vec![]),
            rrule: entry.rrule,
            milestone_id: None,
        };
        match items::create(conn, &input) {
            Ok(created) => {
                summary.imported += 1;
                if entry.completed && input.rrule.is_none() {
                    items::complete(conn, &created.id)?;
                }
            }
            // An entry Kairos' own rules reject (e.g. an end before its start) is skipped.
            Err(AppError::Validation { .. }) => summary.skipped += 1,
            Err(other) => return Err(other),
        }
    }
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::{migrated_conn, scratch_path};
    use crate::models::item::ItemKind;

    fn input(title: &str, due: &str) -> ItemInput {
        ItemInput {
            kind: ItemKind::Task,
            title: title.into(),
            notes: Some("note".into()),
            area_id: None,
            priority: 0,
            start_at: None,
            end_at: None,
            due_date: Some(due.into()),
            location: None,
            source: None,
            reminders: None,
            rrule: None,
            milestone_id: None,
        }
    }

    #[test]
    fn json_export_has_everything_but_the_trash() {
        let mut c = migrated_conn();
        let dir = scratch_path("export");
        fs::create_dir_all(&dir).unwrap();
        items::create(&mut c, &input("Keep", "2030-01-07")).unwrap();
        let gone = items::create(&mut c, &input("Binned", "2030-01-07")).unwrap();
        items::delete(&mut c, &gone.id).unwrap();

        let path = dir.join("kairos.json");
        export_json(&c, &path).unwrap();
        let json: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(json["app"], "Kairos");
        assert_eq!(json["formatVersion"], 1);
        let titles: Vec<&str> = json["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|i| i["title"].as_str().unwrap())
            .collect();
        assert_eq!(titles, ["Keep"]);
        assert_eq!(
            json["reminders"].as_array().unwrap().len(),
            1,
            "the default reminder"
        );
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn calendar_round_trip_without_duplicates() {
        let mut c = migrated_conn();
        let dir = scratch_path("export");
        fs::create_dir_all(&dir).unwrap();
        items::create(&mut c, &input("Dentist", "2030-01-07")).unwrap();
        items::create(
            &mut c,
            &ItemInput {
                rrule: Some("FREQ=WEEKLY".into()),
                ..input("Bins", "2030-01-08")
            },
        )
        .unwrap();
        items::create(
            &mut c,
            &ItemInput {
                due_date: None,
                ..input("Someday", "x")
            },
        )
        .unwrap();

        let path = dir.join("kairos.ics");
        assert_eq!(
            export_ics(&c, &path).unwrap(),
            2,
            "only dated items go into a calendar"
        );

        // Into a fresh database: everything comes in…
        let mut fresh = migrated_conn();
        let summary = import_ics(&mut fresh, &path).unwrap();
        assert_eq!(
            (summary.imported, summary.duplicates, summary.skipped),
            (2, 0, 0)
        );
        let rule: Option<String> = fresh
            .query_row("SELECT rrule FROM items WHERE title = 'Bins'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(rule.as_deref(), Some("FREQ=WEEKLY"));
        let source: String = fresh
            .query_row(
                "SELECT source FROM items WHERE title = 'Dentist'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(source, "import");

        // …and importing the same file again adds nothing.
        let again = import_ics(&mut fresh, &path).unwrap();
        assert_eq!((again.imported, again.duplicates), (0, 2));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn friendly_errors_for_bad_files() {
        let mut c = migrated_conn();
        let dir = scratch_path("export");
        fs::create_dir_all(&dir).unwrap();
        assert!(import_ics(&mut c, &dir.join("missing.ics")).is_err());
        let junk = dir.join("junk.ics");
        fs::write(&junk, "BEGIN:").unwrap();
        assert!(matches!(
            import_ics(&mut c, &junk),
            Err(AppError::Validation {
                reason: "notACalendar",
                ..
            })
        ));
        assert!(export_json(&c, Path::new("relative.json")).is_err());
        fs::remove_dir_all(&dir).ok();
    }
}
