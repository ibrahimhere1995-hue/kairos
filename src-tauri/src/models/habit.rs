use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct Habit {
    pub id: String,
    pub title: String,
    pub area_id: Option<String>,
    /// `daily` or `weekly:N` (N times per week).
    pub frequency: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct HabitInput {
    pub title: String,
    pub area_id: Option<String>,
    pub frequency: String,
}

/// A habit with its progress as of a local day.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct HabitStatus {
    pub habit: Habit,
    pub done_today: bool,
    /// Days (daily) or weeks (weekly) in a row; 0 = paused.
    pub streak: u32,
    pub this_week: u32,
    /// Ticks per week to aim for (7 for daily).
    pub per_week: u32,
    /// Ticked local dates (`YYYY-MM-DD`) in the last 12 weeks, for the heatmap.
    pub recent: Vec<String>,
}
