use serde::Serialize;

/// One stretch of focused work (PRD R16). Pausing ends it; resuming starts another.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct FocusSession {
    pub id: String,
    pub item_id: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub planned_minutes: i64,
}

/// Focused time in a range for one life area (`None` = no task, or a task without an area).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct FocusTotal {
    pub area_id: Option<String>,
    pub seconds: i64,
}
