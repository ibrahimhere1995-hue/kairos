use serde::Serialize;

/// A file attached to an item (P2-T11). The file itself lives in Kairos' attachments folder.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct Attachment {
    pub id: String,
    pub item_id: String,
    /// The original file name, shown to the user.
    pub file_name: String,
    pub mime: String,
    pub size_bytes: i64,
    pub created_at: String,
}
