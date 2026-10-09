/// One reminder of an item, as stored (ARCHITECTURE §4 `reminders`).
#[derive(Debug, Clone, PartialEq)]
pub struct Reminder {
    pub id: String,
    pub item_id: String,
    /// Minutes before the item's moment (0 = at the time). Whole days keep the clock time.
    pub offset_minutes: i64,
    /// Next time it fires (UTC), or None while the item has no date.
    pub fire_at: Option<String>,
    /// Set once it has fired (or its moment passed before it could), until rescheduled or snoozed.
    pub fired_at: Option<String>,
    pub snoozed_until: Option<String>,
}

/// A reminder that is due now, with what the notification needs to show.
#[derive(Debug, Clone, PartialEq)]
pub struct DueReminder {
    pub reminder_id: String,
    pub item_id: String,
    pub title: String,
    pub start_at: Option<String>,
    pub due_date: Option<String>,
    pub fire_at: String,
}
