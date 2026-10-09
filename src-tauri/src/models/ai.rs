use serde::{Deserialize, Serialize};

/// Whether smart features can run: the user agreed to the consent screen and added a key.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct AiStatus {
    pub consented: bool,
    pub has_key: bool,
}

/// A2: what the AI read from a sentence. A draft only: the user checks it before saving.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct AiDraft {
    pub title: String,
    /// Local `YYYY-MM-DD`.
    pub date: Option<String>,
    /// Local `HH:mm` (only with a date).
    pub time: Option<String>,
    /// Only with a time.
    pub duration_minutes: Option<i64>,
    /// "Remind me two days before" → 2880.
    pub reminder_minutes: Option<i64>,
}

/// A1: a task read from a picture. Opens the editor pre-filled; never saved on its own.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct AiImageDraft {
    pub title: String,
    pub date: Option<String>,
    pub time: Option<String>,
    pub duration_minutes: Option<i64>,
    pub location: Option<String>,
    /// Other useful details from the picture (amount, reference, who).
    pub notes: Option<String>,
}

/// A3 "Plan my day / week": what the frontend sends. Local wall-clock strings only; only
/// task titles and lengths and the busy times' titles go to the AI (PRD §7.3).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct PlanRequest {
    /// What the user asked, e.g. "around my Thursday meeting". May be empty.
    pub instruction: String,
    /// Local `YYYY-MM-DDTHH:mm`.
    pub now: String,
    /// Local `HH:mm`: plan only inside these hours.
    pub day_start: String,
    pub day_end: String,
    pub days: Vec<PlanDay>,
    pub tasks: Vec<PlanTask>,
    /// A5: the user's best hours, e.g. "09:00–11:00" (only the range, never the history).
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub preferred_hours: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct PlanDay {
    /// Local `YYYY-MM-DD`.
    pub date: String,
    pub busy: Vec<PlanBusy>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct PlanBusy {
    pub title: String,
    /// Local `HH:mm`.
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct PlanTask {
    pub id: String,
    pub title: String,
    /// The task's own length, if it has one.
    pub duration_minutes: Option<i64>,
}

/// One proposed slot. The user accepts all, some or none.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct PlanProposal {
    pub task_id: String,
    pub date: String,
    /// Local `HH:mm`.
    pub start: String,
    pub duration_minutes: i64,
}

/// A5: the local hours (`start_hour` ≤ h < `end_hour`) you tick most tasks done, learned on
/// this computer from the last 8 weeks.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct BestHours {
    pub start_hour: u32,
    pub end_hour: u32,
    /// Tasks done in those hours, out of `total`.
    pub done: u32,
    pub total: u32,
}
