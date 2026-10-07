use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum ItemKind {
    Task,
    Event,
}

impl ItemKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ItemKind::Task => "task",
            ItemKind::Event => "event",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "task" => Some(ItemKind::Task),
            "event" => Some(ItemKind::Event),
            _ => None,
        }
    }
}

/// How an item was created (ARCHITECTURE §4 `items.source`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum ItemSource {
    Manual,
    Quick,
    Nlp,
    AiImage,
    Template,
    Import,
}

impl ItemSource {
    pub fn as_str(self) -> &'static str {
        match self {
            ItemSource::Manual => "manual",
            ItemSource::Quick => "quick",
            ItemSource::Nlp => "nlp",
            ItemSource::AiImage => "ai_image",
            ItemSource::Template => "template",
            ItemSource::Import => "import",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "manual" => Some(ItemSource::Manual),
            "quick" => Some(ItemSource::Quick),
            "nlp" => Some(ItemSource::Nlp),
            "ai_image" => Some(ItemSource::AiImage),
            "template" => Some(ItemSource::Template),
            "import" => Some(ItemSource::Import),
            _ => None,
        }
    }
}

/// A task or event exactly as stored. Status is never stored; it is computed (P1-T06).
///
/// Scheduling shapes:
/// - date-only (all-day): `due_date` set, `start_at`/`end_at` null, `all_day` true
/// - timed: `start_at` set (events also have `end_at`), `due_date` null
/// - unscheduled (Inbox): all three null
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct Item {
    pub id: String,
    pub kind: ItemKind,
    pub title: String,
    pub notes: Option<String>,
    pub area_id: Option<String>,
    /// 0 none, 1 low, 2 medium, 3 high.
    pub priority: i32,
    pub all_day: bool,
    /// UTC ISO-8601, e.g. `2026-10-07T13:00:00.000Z`.
    pub start_at: Option<String>,
    pub end_at: Option<String>,
    /// Local calendar date `YYYY-MM-DD`.
    pub due_date: Option<String>,
    pub completed_at: Option<String>,
    pub skipped_at: Option<String>,
    pub location: Option<String>,
    pub rrule: Option<String>,
    pub recurrence_parent_id: Option<String>,
    pub original_start_at: Option<String>,
    pub milestone_id: Option<String>,
    pub reschedule_count: i32,
    pub source: ItemSource,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}
