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

/// A day of the week, for the weekly review (PRD R17).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum Weekday {
    Monday,
    Tuesday,
    Wednesday,
    Thursday,
    Friday,
    Saturday,
    #[default]
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
    /// Local `HH:mm`: when all-day tasks remind you (PRD R3 default 09:00).
    pub default_reminder_time: String,
    /// PRD R3: a morning notification with the day ahead.
    pub daily_summary_enabled: bool,
    /// Local `HH:mm` for the daily summary (default 08:00).
    pub daily_summary_time: String,
    /// PRD R3: start Kairos (in the tray) when you sign in. On by default.
    pub launch_at_login: bool,
    /// What Kairos calls you in the greeting ("Good morning, Zack."). Empty = no name.
    pub name: String,
    /// PRD R17: the day the weekly review is offered (Sunday by default).
    pub review_day: Weekday,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: ThemePreference::default(),
            text_size: TextSize::default(),
            week_starts_on: WeekStart::default(),
            default_reminder_time: "09:00".into(),
            daily_summary_enabled: true,
            daily_summary_time: "08:00".into(),
            launch_at_login: true,
            name: String::new(),
            review_day: Weekday::default(),
        }
    }
}
