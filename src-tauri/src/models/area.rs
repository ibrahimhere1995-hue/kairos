use serde::{Deserialize, Serialize};

/// A life area (Work, Home, …). `color` is a design-token key such as `area.work`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct Area {
    pub id: String,
    pub name: String,
    pub color: String,
    /// Lucide icon name, e.g. `briefcase`.
    pub icon: String,
    pub sort_order: i32,
    pub is_archived: bool,
}

/// Add or edit an area: its name and colour token key (one of the area colours).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct AreaInput {
    pub name: String,
    pub color: String,
}
