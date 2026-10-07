use serde::{Deserialize, Serialize};

use crate::models::item::Item;

/// "Now" for My Day, computed by the frontend in the user's timezone.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct DashboardQuery {
    /// Current instant, UTC.
    pub now: String,
    /// Local midnight today and tomorrow, as UTC instants.
    pub day_start: String,
    pub day_end: String,
    /// Today's local date, `YYYY-MM-DD`.
    pub today: String,
    /// End of "this week" (exclusive), as a UTC instant and as a local date.
    pub week_end: String,
    pub week_end_date: String,
}

/// My Day data, grouped by time window. The status engine (P1-T06) decides each item's
/// status, and P1-T08 places items into Now / Today / Slipped / This week / Done today.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct Dashboard {
    /// Not finished, scheduled at any time today (includes events in progress).
    pub today: Vec<Item>,
    /// Unfinished **tasks** scheduled before today (only tasks can slip).
    pub overdue: Vec<Item>,
    /// Not finished, scheduled after today and before the end of the week.
    pub this_week: Vec<Item>,
    /// Completed today.
    pub done_today: Vec<Item>,
}
