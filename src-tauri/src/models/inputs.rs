use serde::Deserialize;

use crate::models::item::{ItemKind, ItemSource};

/// Everything the item editor can set. Used for create and for full-replace update.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct ItemInput {
    pub kind: ItemKind,
    pub title: String,
    pub notes: Option<String>,
    pub area_id: Option<String>,
    /// 0 none, 1 low, 2 medium, 3 high.
    pub priority: i32,
    /// Timed items: any RFC 3339 timestamp; stored normalised to UTC.
    pub start_at: Option<String>,
    pub end_at: Option<String>,
    /// Date-only items: local `YYYY-MM-DD`. Cannot be combined with `start_at`.
    pub due_date: Option<String>,
    pub location: Option<String>,
    /// Ignored on update. Defaults to `manual`.
    pub source: Option<ItemSource>,
    /// Reminder offsets in minutes before the item's moment (0 = at the time; whole days keep
    /// the clock time). Omitted: a new item gets the default reminder (PRD R3), an edited item
    /// keeps its reminders. Empty: no reminders.
    #[serde(default)]
    #[cfg_attr(test, ts(optional))]
    pub reminders: Option<Vec<i64>>,
}

/// New schedule for `reschedule_item` (drag on the calendar, the slipped-items card).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct ScheduleInput {
    pub start_at: Option<String>,
    pub end_at: Option<String>,
    pub due_date: Option<String>,
}

/// A visible calendar range. The frontend owns the user's timezone, so it sends the range
/// both as UTC instants (for timed items) and as local dates (for date-only items).
/// Both ends are exclusive at the end: `[start, end)` and `[startDate, endDate)`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct DateRange {
    pub start: String,
    pub end: String,
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct ItemFilters {
    /// Only these life areas; empty means all areas.
    #[serde(default)]
    pub area_ids: Vec<String>,
}
