//! What reminder notifications and the tray say (texts from the i18n file).

use chrono::{DateTime, NaiveDate, TimeZone, Utc};

use crate::i18n::{t, t_count};
use crate::models::reminder::DueReminder;
use crate::services::today::{NextItem, TodayOverview};

/// Titles listed in a combined "While you were away" notification before "+N more".
const AWAY_TITLES: usize = 3;

/// What happens when the notification (not one of its buttons) is clicked.
#[derive(Debug, Clone, PartialEq)]
pub enum Target {
    Item(String),
    MyDay,
}

/// A reminder's ids, for the Done / Snooze buttons.
#[derive(Debug, Clone, PartialEq)]
pub struct ReminderRef {
    pub reminder_id: String,
    pub item_id: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Notice {
    pub title: String,
    pub body: String,
    pub target: Target,
    /// Set for a single reminder: the notification gets Done / Snooze buttons.
    pub reminder: Option<ReminderRef>,
}

/// "3:00 PM" (matches the app's English time format).
pub fn clock_time<Tz: TimeZone>(tz: &Tz, at: DateTime<Utc>) -> String
where
    Tz::Offset: std::fmt::Display,
{
    at.with_timezone(tz).format("%-I:%M %p").to_string()
}

/// "Today at 3:00 PM", "Tomorrow", "Mon 12 Oct at 9:30 AM"…
pub fn when_text<Tz: TimeZone>(
    tz: &Tz,
    now: DateTime<Utc>,
    start_at: Option<&str>,
    due_date: Option<&str>,
) -> String
where
    Tz::Offset: std::fmt::Display,
{
    let today = now.with_timezone(tz).date_naive();
    let start = start_at
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|s| s.with_timezone(&Utc));
    let day = match start {
        Some(s) => s.with_timezone(tz).date_naive(),
        None => match due_date.and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()) {
            Some(d) => d,
            None => return String::new(),
        },
    };
    let date = day.format("%a %-d %b").to_string();
    match start {
        Some(s) => {
            let time = clock_time(tz, s);
            if day == today {
                t("notifications.todayAt", &[("time", &time)])
            } else if Some(day) == today.succ_opt() {
                t("notifications.tomorrowAt", &[("time", &time)])
            } else {
                t("notifications.onDayAt", &[("date", &date), ("time", &time)])
            }
        }
        None => {
            if day == today {
                t("notifications.today", &[])
            } else if Some(day) == today.succ_opt() {
                t("notifications.tomorrow", &[])
            } else {
                t("notifications.onDay", &[("date", &date)])
            }
        }
    }
}

pub fn reminder<Tz: TimeZone>(tz: &Tz, now: DateTime<Utc>, due: &DueReminder) -> Notice
where
    Tz::Offset: std::fmt::Display,
{
    Notice {
        title: due.title.clone(),
        body: when_text(tz, now, due.start_at.as_deref(), due.due_date.as_deref()),
        target: Target::Item(due.item_id.clone()),
        reminder: Some(ReminderRef {
            reminder_id: due.reminder_id.clone(),
            item_id: due.item_id.clone(),
        }),
    }
}

/// One notification for several reminders missed while the computer was asleep or off.
pub fn away(missed: &[DueReminder]) -> Notice {
    let mut titles: Vec<String> = missed
        .iter()
        .take(AWAY_TITLES)
        .map(|d| d.title.clone())
        .collect();
    if missed.len() > AWAY_TITLES {
        let more = (missed.len() - AWAY_TITLES).to_string();
        titles.push(t("notifications.moreItems", &[("count", &more)]));
    }
    Notice {
        title: t("notifications.awayTitle", &[]),
        body: t_count(
            "notifications.awayBody",
            missed.len(),
            &[("titles", &titles.join(", "))],
        ),
        target: Target::MyDay,
        reminder: None,
    }
}

pub fn daily_summary(today: &TodayOverview) -> Notice {
    let mut parts = Vec::new();
    if today.tasks > 0 {
        parts.push(t_count("notifications.summaryTasks", today.tasks, &[]));
    }
    if today.events > 0 {
        parts.push(t_count("notifications.summaryEvents", today.events, &[]));
    }
    let mut body = match parts.as_slice() {
        [] => t("notifications.summaryEmpty", &[]),
        [one] => t("notifications.summaryToday", &[("list", one)]),
        [first, second, ..] => {
            let list = t(
                "notifications.summaryAnd",
                &[("first", first), ("second", second)],
            );
            t("notifications.summaryToday", &[("list", &list)])
        }
    };
    if today.slipped > 0 {
        body.push(' ');
        body.push_str(&t_count("notifications.summarySlipped", today.slipped, &[]));
    }
    Notice {
        title: t("notifications.summaryTitle", &[]),
        body,
        target: Target::MyDay,
        reminder: None,
    }
}

/// The tray menu's "next item" line.
pub fn tray_next<Tz: TimeZone>(tz: &Tz, next: Option<&NextItem>) -> String
where
    Tz::Offset: std::fmt::Display,
{
    match next {
        None => t("tray.nothingNext", &[]),
        Some(NextItem {
            title,
            start_at: Some(at),
            ..
        }) => t(
            "tray.nextAt",
            &[("title", title), ("time", &clock_time(tz, *at))],
        ),
        Some(NextItem { title, .. }) => t("tray.nextToday", &[("title", title)]),
    }
}

#[cfg(test)]
mod tests {
    use chrono::FixedOffset;

    use super::*;

    fn utc(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    fn plus2() -> FixedOffset {
        FixedOffset::east_opt(2 * 3600).unwrap()
    }

    fn due(title: &str) -> DueReminder {
        DueReminder {
            reminder_id: format!("r-{title}"),
            item_id: format!("i-{title}"),
            title: title.into(),
            start_at: Some("2030-01-10T13:00:00.000Z".into()),
            due_date: None,
            fire_at: "2030-01-10T13:00:00.000Z".into(),
        }
    }

    #[test]
    fn describes_when_in_local_time() {
        let now = utc("2030-01-10T08:00:00Z"); // 10:00 local
        let tz = plus2();
        assert_eq!(
            when_text(&tz, now, Some("2030-01-10T13:00:00Z"), None),
            "Today at 3:00 PM"
        );
        assert_eq!(
            when_text(&tz, now, Some("2030-01-11T07:30:00Z"), None),
            "Tomorrow at 9:30 AM"
        );
        assert_eq!(
            when_text(&tz, now, Some("2030-01-14T07:30:00Z"), None),
            "Mon 14 Jan at 9:30 AM"
        );
        assert_eq!(when_text(&tz, now, None, Some("2030-01-10")), "Today");
        assert_eq!(when_text(&tz, now, None, Some("2030-01-11")), "Tomorrow");
        assert_eq!(when_text(&tz, now, None, Some("2030-01-20")), "Sun 20 Jan");
        // 23:30 UTC on the 10th is already the 11th locally.
        assert_eq!(
            when_text(&tz, now, Some("2030-01-10T23:30:00Z"), None),
            "Tomorrow at 1:30 AM"
        );
        assert_eq!(when_text(&tz, now, None, None), "");
    }

    #[test]
    fn single_reminder_has_buttons_and_opens_the_item() {
        let n = reminder(&plus2(), utc("2030-01-10T08:00:00Z"), &due("Dentist"));
        assert_eq!(n.title, "Dentist");
        assert_eq!(n.body, "Today at 3:00 PM");
        assert_eq!(n.target, Target::Item("i-Dentist".into()));
        assert_eq!(n.reminder.unwrap().reminder_id, "r-Dentist");
    }

    #[test]
    fn missed_reminders_are_combined() {
        let one = away(&[due("A")]);
        assert_eq!(one.title, "While you were away");
        assert_eq!(one.body, "1 reminder: A");
        let many = away(&[due("A"), due("B"), due("C"), due("D"), due("E")]);
        assert_eq!(many.body, "5 reminders: A, B, C, +2 more");
        assert_eq!(many.target, Target::MyDay);
        assert!(many.reminder.is_none());
    }

    #[test]
    fn daily_summary_wording() {
        let summary = |tasks, events, slipped| {
            daily_summary(&TodayOverview {
                tasks,
                events,
                slipped,
                next: None,
            })
            .body
        };
        assert_eq!(
            summary(0, 0, 0),
            "Nothing planned today. A good moment to add something."
        );
        assert_eq!(summary(1, 0, 0), "Today: 1 task.");
        assert_eq!(summary(3, 2, 0), "Today: 3 tasks and 2 events.");
        assert_eq!(
            summary(0, 1, 2),
            "Today: 1 event. 2 slipped by, ready for a new moment."
        );
        assert_eq!(daily_summary(&TodayOverview::default()).title, "Your day");
    }

    #[test]
    fn tray_next_line() {
        let tz = plus2();
        assert_eq!(tray_next(&tz, None), "Nothing else today");
        let timed = NextItem {
            id: "1".into(),
            title: "Lunch".into(),
            start_at: Some(utc("2030-01-10T10:00:00Z")),
        };
        assert_eq!(tray_next(&tz, Some(&timed)), "Next: Lunch · 12:00 PM");
        let dated = NextItem {
            id: "2".into(),
            title: "Bins".into(),
            start_at: None,
        };
        assert_eq!(tray_next(&tz, Some(&dated)), "Next: Bins");
    }
}
