//! User-facing text shown by the backend itself (OS notifications, tray menu).
//! It comes from the same i18n file as the frontend (PROJECT_RULES #8), compiled in.

use std::sync::OnceLock;

use serde_json::Value;

const EN: &str = include_str!("../../src/i18n/locales/en.json");

fn strings() -> &'static Value {
    static STRINGS: OnceLock<Value> = OnceLock::new();
    STRINGS.get_or_init(|| serde_json::from_str(EN).unwrap_or(Value::Null))
}

fn lookup(key: &str) -> Option<&'static str> {
    key.split('.')
        .try_fold(strings(), |node, part| node.get(part))
        .and_then(Value::as_str)
}

/// The text for `key` (dotted, e.g. `notifications.done`) with `{{name}}` placeholders filled.
/// A missing key returns the key itself, so a mistake is visible rather than silent.
pub fn t(key: &str, vars: &[(&str, &str)]) -> String {
    let mut text = lookup(key).unwrap_or(key).to_owned();
    for (name, value) in vars {
        text = text.replace(&format!("{{{{{name}}}}}"), value);
    }
    text
}

/// Plural form, the i18next way: `key_one` for 1, `key_other` otherwise; `{{count}}` is filled.
pub fn t_count(key: &str, count: usize, vars: &[(&str, &str)]) -> String {
    let suffix = if count == 1 { "one" } else { "other" };
    let count_text = count.to_string();
    let mut all = vec![("count", count_text.as_str())];
    all.extend_from_slice(vars);
    t(&format!("{key}_{suffix}"), &all)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_shared_english_file() {
        assert_eq!(t("nav.myDay", &[]), "My Day");
        assert_eq!(t("editor.stepText", &[("number", "3")]), "Step 3");
        assert_eq!(t("no.such.key", &[]), "no.such.key");
        assert_eq!(t_count("myDay.summaryTasks", 1, &[]), "1 task today");
        assert_eq!(t_count("myDay.summaryTasks", 4, &[]), "4 tasks today");
    }

    /// Every key the backend uses must exist, so no user ever sees a raw key.
    #[test]
    fn every_backend_key_exists() {
        let keys = [
            "notifications.done",
            "notifications.snooze10",
            "notifications.snooze1h",
            "notifications.snoozeTomorrow",
            "notifications.today",
            "notifications.tomorrow",
            "notifications.todayAt",
            "notifications.tomorrowAt",
            "notifications.onDay",
            "notifications.onDayAt",
            "notifications.awayTitle",
            "notifications.moreItems",
            "notifications.summaryTitle",
            "notifications.summaryEmpty",
            "notifications.summaryToday",
            "notifications.summaryAnd",
            "notifications.trayHintTitle",
            "notifications.trayHintBody",
            "onboarding.samples.tick",
            "onboarding.samples.capture",
            "onboarding.samples.open",
            "portability.untitled",
            "inbox.pictureTitle",
            "tray.tooltip",
            "tray.open",
            "tray.quickAdd",
            "tray.quit",
            "tray.nothingNext",
            "tray.nextAt",
            "tray.nextToday",
        ];
        for key in keys {
            assert!(lookup(key).is_some(), "missing i18n key {key}");
        }
        for key in [
            "notifications.awayBody",
            "notifications.summaryTasks",
            "notifications.summaryEvents",
            "notifications.summarySlipped",
        ] {
            for form in ["one", "other"] {
                assert!(
                    lookup(&format!("{key}_{form}")).is_some(),
                    "missing i18n key {key}_{form}"
                );
            }
        }
    }
}
