use serde::{Deserialize, Serialize};

use crate::models::item::Item;

/// One sub-step of an item.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct ChecklistItem {
    pub id: String,
    pub item_id: String,
    pub text: String,
    pub done: bool,
    pub sort_order: i32,
}

/// Editor input: the full list in display order. Entries with an `id` update that step;
/// entries without one are new; existing steps missing from the list move to the Trash.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct ChecklistEntryInput {
    pub id: Option<String>,
    pub text: String,
    pub done: bool,
}

/// An item with everything the editor shows.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct ItemDetail {
    pub item: Item,
    pub checklist: Vec<ChecklistItem>,
}
