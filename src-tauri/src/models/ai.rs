use serde::Serialize;

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
