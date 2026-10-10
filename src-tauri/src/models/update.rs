use serde::Serialize;

/// A newer Kairos that can be installed (P4-T05).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct UpdateInfo {
    pub version: String,
    /// Release notes, if the release has any.
    pub notes: Option<String>,
}
