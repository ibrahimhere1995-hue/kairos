use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum ThemePreference {
    Light,
    Dark,
    #[default]
    System,
}

/// DESIGN_SYSTEM §4: Small 0.9, Default 1.0, Large 1.125, Extra large 1.25.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum TextSize {
    Small,
    #[default]
    Default,
    Large,
    Xl,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum WeekStart {
    #[default]
    Monday,
    Sunday,
}

/// Basic settings (P1-T16). Every field has a sensible default (PRD R7: nothing is required).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct AppSettings {
    pub theme: ThemePreference,
    pub text_size: TextSize,
    pub week_starts_on: WeekStart,
    /// Local `HH:mm`: when all-day tasks remind you (PRD R3 default 09:00). Used from Phase 2.
    pub default_reminder_time: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: ThemePreference::default(),
            text_size: TextSize::default(),
            week_starts_on: WeekStart::default(),
            default_reminder_time: "09:00".into(),
        }
    }
}
