use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct Goal {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub area_id: Option<String>,
    /// Local `YYYY-MM-DD`.
    pub target_date: Option<String>,
    pub achieved_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct Milestone {
    pub id: String,
    pub goal_id: String,
    pub title: String,
    pub target_date: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct GoalInput {
    pub title: String,
    pub description: Option<String>,
    pub area_id: Option<String>,
    pub target_date: Option<String>,
}

/// Progress counts tasks linked to a milestone (not repeating series): done of all.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct MilestoneProgress {
    pub milestone: Milestone,
    pub done: u32,
    pub total: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct GoalProgress {
    pub goal: Goal,
    pub milestones: Vec<MilestoneProgress>,
    pub done: u32,
    pub total: u32,
}
