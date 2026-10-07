//! Checklist (sub-steps) and the item detail the editor loads.

use std::collections::HashMap;

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::checklist::{ChecklistEntryInput, ChecklistItem, ItemDetail};
use crate::repo::{checklist as repo, items};
use crate::util::{new_id, now_utc};

pub const STEP_MAX_CHARS: usize = 500;
pub const MAX_STEPS: usize = 100;

fn active_item_exists(conn: &Connection, item_id: &str) -> AppResult<()> {
    match items::get(conn, item_id)? {
        Some(item) if item.deleted_at.is_none() => Ok(()),
        _ => Err(AppError::NotFound),
    }
}

pub fn get_detail(conn: &Connection, item_id: &str) -> AppResult<ItemDetail> {
    let item = items::get(conn, item_id)?
        .filter(|item| item.deleted_at.is_none())
        .ok_or(AppError::NotFound)?;
    let checklist = repo::list_for_item(conn, item_id)?;
    Ok(ItemDetail { item, checklist })
}

/// Replaces an item's steps with `entries` (in order) in one transaction.
/// Blank entries are ignored; removed steps are soft-deleted.
pub fn set_checklist(
    conn: &mut Connection,
    item_id: &str,
    entries: &[ChecklistEntryInput],
) -> AppResult<Vec<ChecklistItem>> {
    let tx = conn.transaction()?;
    active_item_exists(&tx, item_id)?;

    let wanted: Vec<(&ChecklistEntryInput, String)> = entries
        .iter()
        .filter_map(|e| {
            let text = e.text.trim();
            (!text.is_empty()).then(|| (e, text.to_owned()))
        })
        .collect();
    if wanted.len() > MAX_STEPS {
        return Err(AppError::invalid("checklist", "tooMany"));
    }
    if wanted
        .iter()
        .any(|(_, text)| text.chars().count() > STEP_MAX_CHARS)
    {
        return Err(AppError::invalid("checklist", "tooLong"));
    }

    let mut existing: HashMap<String, ChecklistItem> = repo::list_for_item(&tx, item_id)?
        .into_iter()
        .map(|step| (step.id.clone(), step))
        .collect();
    let now = now_utc();

    for (index, (entry, text)) in wanted.into_iter().enumerate() {
        let sort_order = i32::try_from(index).unwrap_or(i32::MAX);
        // Unknown ids (e.g. a step deleted elsewhere) are treated as new steps.
        match entry.id.as_ref().and_then(|id| existing.remove(id)) {
            Some(mut step) => {
                step.text = text;
                step.done = entry.done;
                step.sort_order = sort_order;
                repo::update(&tx, &step, &now)?;
            }
            None => {
                let step = ChecklistItem {
                    id: new_id(),
                    item_id: item_id.to_owned(),
                    text,
                    done: entry.done,
                    sort_order,
                };
                repo::insert(&tx, &step, &now)?;
            }
        }
    }
    for removed in existing.keys() {
        repo::soft_delete(&tx, removed, &now)?;
    }

    let saved = repo::list_for_item(&tx, item_id)?;
    tx.commit()?;
    Ok(saved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;
    use crate::models::inputs::ItemInput;
    use crate::models::item::ItemKind;
    use crate::services::items;

    fn setup() -> (Connection, String) {
        let mut conn = migrated_conn();
        let item = items::create(
            &mut conn,
            &ItemInput {
                kind: ItemKind::Task,
                title: "Plan trip".into(),
                notes: None,
                area_id: None,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: None,
                location: None,
                source: None,
            },
        )
        .unwrap();
        (conn, item.id)
    }

    fn entry(id: Option<&str>, text: &str, done: bool) -> ChecklistEntryInput {
        ChecklistEntryInput {
            id: id.map(Into::into),
            text: text.into(),
            done,
        }
    }

    fn texts(steps: &[ChecklistItem]) -> Vec<(&str, bool)> {
        steps.iter().map(|s| (s.text.as_str(), s.done)).collect()
    }

    #[test]
    fn creates_updates_reorders_and_removes_steps() {
        let (mut c, item) = setup();
        let saved = set_checklist(
            &mut c,
            &item,
            &[
                entry(None, "Book flights", false),
                entry(None, " Pack ", false),
                entry(None, "  ", false),
            ],
        )
        .unwrap();
        assert_eq!(
            texts(&saved),
            [("Book flights", false), ("Pack", false)],
            "trimmed, blanks dropped"
        );

        let flights = saved[0].id.clone();
        let pack = saved[1].id.clone();
        let saved = set_checklist(
            &mut c,
            &item,
            &[
                entry(Some(&pack), "Pack bags", true),
                entry(None, "Hotel", false),
            ],
        )
        .unwrap();
        assert_eq!(texts(&saved), [("Pack bags", true), ("Hotel", false)]);
        assert_eq!(saved[0].id, pack, "existing step keeps its id");

        let trashed: Option<String> = c
            .query_row(
                "SELECT deleted_at FROM checklist_items WHERE id = ?1",
                [&flights],
                |r| r.get(0),
            )
            .unwrap();
        assert!(
            trashed.is_some(),
            "removed step is soft-deleted, not erased"
        );

        assert_eq!(get_detail(&c, &item).unwrap().checklist.len(), 2);
    }

    #[test]
    fn rejects_unknown_items_and_overlong_steps() {
        let (mut c, item) = setup();
        assert!(matches!(
            set_checklist(&mut c, "missing", &[]),
            Err(AppError::NotFound)
        ));
        let err =
            set_checklist(&mut c, &item, &[entry(None, &"x".repeat(501), false)]).unwrap_err();
        assert!(matches!(
            err,
            AppError::Validation {
                reason: "tooLong",
                ..
            }
        ));
    }

    #[test]
    fn trashed_items_have_no_detail() {
        let (mut c, item) = setup();
        items::delete(&mut c, &item).unwrap();
        assert!(matches!(get_detail(&c, &item), Err(AppError::NotFound)));
    }
}
