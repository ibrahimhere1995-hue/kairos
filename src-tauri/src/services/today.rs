//! Today at a glance, for the daily summary notification and the tray's "next item".

use chrono::{DateTime, NaiveTime, TimeZone, Utc};
use rusqlite::Connection;

use crate::error::AppResult;
use crate::models::item::{Item, ItemKind};
use crate::repo::items;
use crate::scheduler::timing::local_to_utc;
use crate::services::reminders::iso;
use crate::services::series;

#[derive(Debug, Clone, PartialEq)]
pub struct NextItem {
    pub id: String,
    pub title: String,
    /// None for a date-only task (it has no time).
    pub start_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct TodayOverview {
    /// Unfinished tasks today.
    pub tasks: usize,
    /// Events today (finished or not: events aren't ticked off).
    pub events: usize,
    /// Tasks from earlier days that slipped by.
    pub slipped: usize,
    /// The next timed item still to start today, else the first date-only task.
    pub next: Option<NextItem>,
}

fn start_of(item: &Item) -> Option<DateTime<Utc>> {
    item.start_at
        .as_deref()
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|t| t.with_timezone(&Utc))
}

pub fn overview<Tz: TimeZone>(
    conn: &Connection,
    tz: &Tz,
    now: DateTime<Utc>,
) -> AppResult<TodayOverview> {
    let today = now.with_timezone(tz).date_naive();
    let tomorrow = today.succ_opt().unwrap_or(today);
    let day_start = iso(local_to_utc(tz, today.and_time(NaiveTime::MIN)));
    let day_end = iso(local_to_utc(tz, tomorrow.and_time(NaiveTime::MIN)));
    let today_text = today.format("%Y-%m-%d").to_string();

    let (start_utc, end_utc) = (
        local_to_utc(tz, today.and_time(NaiveTime::MIN)),
        local_to_utc(tz, tomorrow.and_time(NaiveTime::MIN)),
    );
    let mut open = items::open_today(conn, &day_start, &day_end, &today_text)?;
    open.extend(series::in_range(
        conn, tz, start_utc, end_utc, today, tomorrow,
    )?);
    // Missed routines (repeating tasks) have their own calm card and aren't counted here.
    let slipped = items::overdue_tasks(conn, &day_start, &today_text)?.len();

    let upcoming = open
        .iter()
        .filter_map(|item| start_of(item).filter(|t| *t >= now).map(|t| (t, item)))
        .min_by_key(|(t, _)| *t)
        .map(|(t, item)| NextItem {
            id: item.id.clone(),
            title: item.title.clone(),
            start_at: Some(t),
        });
    let first_dated = open
        .iter()
        .find(|item| item.kind == ItemKind::Task && item.start_at.is_none())
        .map(|item| NextItem {
            id: item.id.clone(),
            title: item.title.clone(),
            start_at: None,
        });

    Ok(TodayOverview {
        tasks: open.iter().filter(|i| i.kind == ItemKind::Task).count(),
        events: open.iter().filter(|i| i.kind == ItemKind::Event).count(),
        slipped,
        next: upcoming.or(first_dated),
    })
}

#[cfg(test)]
mod tests {
    use chrono::FixedOffset;

    use super::*;
    use crate::db::test_support::migrated_conn;
    use crate::models::inputs::ItemInput;
    use crate::services::items as item_service;

    fn add(
        c: &mut Connection,
        kind: ItemKind,
        title: &str,
        start: Option<&str>,
        end: Option<&str>,
        due: Option<&str>,
    ) -> Item {
        item_service::create(
            c,
            &ItemInput {
                kind,
                title: title.into(),
                notes: None,
                area_id: None,
                priority: 0,
                start_at: start.map(Into::into),
                end_at: end.map(Into::into),
                due_date: due.map(Into::into),
                location: None,
                source: None,
                reminders: Some(vec![]),
                rrule: None,
            },
        )
        .unwrap()
    }

    fn utc(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn counts_today_and_finds_the_next_item() {
        let mut c = migrated_conn();
        let tz = FixedOffset::east_opt(2 * 3600).unwrap(); // local day 2030-01-10 = 09T22:00Z..10T22:00Z
        add(
            &mut c,
            ItemKind::Task,
            "Bins",
            None,
            None,
            Some("2030-01-10"),
        );
        add(
            &mut c,
            ItemKind::Task,
            "Call",
            Some("2030-01-10T08:00:00Z"),
            None,
            None,
        );
        let lunch = add(
            &mut c,
            ItemKind::Event,
            "Lunch",
            Some("2030-01-10T10:00:00Z"),
            Some("2030-01-10T11:00:00Z"),
            None,
        );
        add(
            &mut c,
            ItemKind::Event,
            "Late",
            Some("2030-01-10T21:30:00Z"),
            Some("2030-01-10T21:45:00Z"),
            None,
        );
        add(
            &mut c,
            ItemKind::Task,
            "Old",
            None,
            None,
            Some("2030-01-08"),
        );
        add(
            &mut c,
            ItemKind::Task,
            "Tomorrow",
            None,
            None,
            Some("2030-01-11"),
        );
        let done = add(
            &mut c,
            ItemKind::Task,
            "Done",
            None,
            None,
            Some("2030-01-10"),
        );
        item_service::complete(&mut c, &done.id).unwrap();

        let now = utc("2030-01-10T09:00:00Z"); // 11:00 local
        let o = overview(&c, &tz, now).unwrap();
        assert_eq!((o.tasks, o.events, o.slipped), (2, 2, 1));
        let next = o.next.unwrap();
        assert_eq!(next.id, lunch.id, "the call at 10:00 local has passed");
        assert_eq!(next.start_at, Some(utc("2030-01-10T10:00:00Z")));

        let evening = overview(&c, &tz, utc("2030-01-10T21:50:00Z")).unwrap();
        assert_eq!(
            evening.next.unwrap().title,
            "Bins",
            "no timed item left: the date-only task"
        );
    }

    #[test]
    fn empty_day() {
        let c = migrated_conn();
        let o = overview(&c, &Utc, utc("2030-01-10T09:00:00Z")).unwrap();
        assert_eq!(o, TodayOverview::default());
    }
}
