use serde::{Deserialize, Serialize};

/// One wishlist entry (PRD R19). Kind: `idea` | `frustration` | `bug`;
/// status: `open` | `planned` | `done`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct Feedback {
    pub id: String,
    pub kind: String,
    pub text: String,
    /// Where it was written (a screen name), if the user chose to include it.
    pub context: Option<String>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct FeedbackInput {
    pub kind: String,
    pub text: String,
    pub context: Option<String>,
}
