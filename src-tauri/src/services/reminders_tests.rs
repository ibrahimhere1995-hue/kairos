use chrono::{Duration, FixedOffset};

use super::*;
use crate::db::test_support::migrated_conn;
use crate::models::inputs::{ItemInput, ScheduleInput};
use crate::models::item::ItemKind;
use crate::services::items;

// Items far in the future, so the real clock used by the item service never makes them due.
const FUTURE_DAY: &str = "2030-01-10";
const FUTURE_START: &str = "2030-01-10T14:00:00.000Z";

fn utc(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
}

fn input(title: &str) -> ItemInput {
    ItemInput {
        kind: ItemKind::Task,
        title: title.into(),
        notes: None,
        area_id: None,
        priority: 0,
        start_at: None,
        end_at: None,
        due_date: None,
        location: None,
        source: None,
        reminders: None,
        rrule: None,
        milestone_id: None,
    }
}

fn timed(title: &str, start: &str) -> ItemInput {
    ItemInput {
        start_at: Some(start.into()),
        ..input(title)
    }
}

fn dated(title: &str, day: &str) -> ItemInput {
    ItemInput {
        due_date: Some(day.into()),
        ..input(title)
    }
}

fn rows(c: &Connection, item_id: &str) -> Vec<Reminder> {
    repo::list_for_item(c, item_id).unwrap()
}

/// A fixed clock in UTC+2 with a 09:00 default reminder time.
fn clock(now: &str) -> Clock<FixedOffset> {
    Clock {
        tz: FixedOffset::east_opt(2 * 3600).unwrap(),
        day_time: NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
        now: utc(now),
    }
}

#[test]
fn new_items_get_the_default_reminder() {
    let mut c = migrated_conn();
    let item = items::create(&mut c, &timed("Dentist", FUTURE_START)).unwrap();
    let saved = rows(&c, &item.id);
    assert_eq!(saved.len(), 1);
    assert_eq!(saved[0].offset_minutes, 0);
    assert_eq!(
        saved[0].fire_at.as_deref(),
        Some(FUTURE_START),
        "at the start time"
    );
    assert_eq!(saved[0].fired_at, None);

    let day = items::create(&mut c, &dated("Pay rent", FUTURE_DAY)).unwrap();
    let expected = timing::anchor(
        &Local,
        None,
        Some(FUTURE_DAY),
        NaiveTime::from_hms_opt(9, 0, 0).unwrap(),
    )
    .unwrap();
    assert_eq!(
        rows(&c, &day.id)[0].fire_at,
        Some(iso(expected)),
        "09:00 local on the day"
    );
}

#[test]
fn chosen_offsets_are_sorted_deduplicated_and_validated() {
    let mut c = migrated_conn();
    let item = items::create(
        &mut c,
        &ItemInput {
            reminders: Some(vec![15, 0, 15, 1440]),
            ..timed("Flight", FUTURE_START)
        },
    )
    .unwrap();
    let offsets: Vec<i64> = rows(&c, &item.id)
        .iter()
        .map(|r| r.offset_minutes)
        .collect();
    assert_eq!(offsets, [0, 15, 1440]);
    assert_eq!(
        rows(&c, &item.id)[1].fire_at.as_deref(),
        Some("2030-01-10T13:45:00.000Z")
    );

    let none = items::create(
        &mut c,
        &ItemInput {
            reminders: Some(vec![]),
            rrule: None,
            ..timed("Quiet", FUTURE_START)
        },
    )
    .unwrap();
    assert!(
        rows(&c, &none.id).is_empty(),
        "an empty list means no reminders"
    );

    for bad in [vec![-5], vec![MAX_OFFSET_MINUTES + 1], (0..11).collect()] {
        let before: i64 = c
            .query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))
            .unwrap();
        let err = items::create(
            &mut c,
            &ItemInput {
                reminders: Some(bad.clone()),
                ..timed("Bad", FUTURE_START)
            },
        );
        assert!(err.is_err(), "{bad:?} must be rejected");
        let after: i64 = c
            .query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            before, after,
            "nothing is written when reminders are invalid"
        );
    }
}

#[test]
fn editing_keeps_or_replaces_reminders() {
    let mut c = migrated_conn();
    let item = items::create(&mut c, &timed("Call", FUTURE_START)).unwrap();
    let first = rows(&c, &item.id)[0].id.clone();

    items::update(&mut c, &item.id, &timed("Call mum", FUTURE_START)).unwrap();
    assert_eq!(
        rows(&c, &item.id)[0].id,
        first,
        "omitted reminders are kept"
    );

    items::update(
        &mut c,
        &item.id,
        &ItemInput {
            reminders: Some(vec![0, 60]),
            ..timed("Call mum", FUTURE_START)
        },
    )
    .unwrap();
    let saved = rows(&c, &item.id);
    assert_eq!(saved.len(), 2);
    assert_eq!(saved[0].id, first, "a kept offset keeps its row");

    items::update(
        &mut c,
        &item.id,
        &ItemInput {
            reminders: Some(vec![60]),
            ..timed("Call mum", FUTURE_START)
        },
    )
    .unwrap();
    assert_eq!(rows(&c, &item.id).len(), 1);
    let deleted: Option<String> = c
        .query_row(
            "SELECT deleted_at FROM reminders WHERE id = ?1",
            [&first],
            |r| r.get(0),
        )
        .unwrap();
    assert!(deleted.is_some(), "removed reminders are soft-deleted");
}

#[test]
fn unscheduled_items_wait_for_a_date() {
    let mut c = migrated_conn();
    let item = items::create(&mut c, &input("Someday")).unwrap();
    assert_eq!(rows(&c, &item.id)[0].fire_at, None);

    items::reschedule(
        &mut c,
        &item.id,
        &ScheduleInput {
            start_at: Some(FUTURE_START.into()),
            ..ScheduleInput::default()
        },
    )
    .unwrap();
    assert_eq!(rows(&c, &item.id)[0].fire_at.as_deref(), Some(FUTURE_START));
}

#[test]
fn moments_already_past_do_not_go_off() {
    let mut c = migrated_conn();
    let item = items::create(&mut c, &dated("Old", "2020-01-01")).unwrap();
    let saved = &rows(&c, &item.id)[0];
    assert!(
        saved.fired_at.is_some(),
        "a reminder for a time already gone counts as fired"
    );
    assert!(take_due(&mut c, Utc::now()).unwrap().is_empty());
}

#[test]
fn due_reminders_fire_once_and_only_for_open_items() {
    let mut c = migrated_conn();
    let open = items::create(&mut c, &timed("Open", FUTURE_START)).unwrap();
    let done = items::create(&mut c, &timed("Done", FUTURE_START)).unwrap();
    let trashed = items::create(&mut c, &timed("Trashed", FUTURE_START)).unwrap();
    items::complete(&mut c, &done.id).unwrap();
    items::delete(&mut c, &trashed.id).unwrap();

    assert!(
        take_due(&mut c, utc("2030-01-10T13:59:59Z"))
            .unwrap()
            .is_empty(),
        "not yet"
    );
    let due = take_due(&mut c, utc("2030-01-10T14:00:00Z")).unwrap();
    assert_eq!(due.len(), 1);
    assert_eq!(due[0].item_id, open.id);
    assert_eq!(due[0].title, "Open");
    assert_eq!(due[0].fire_at, FUTURE_START);
    assert!(
        take_due(&mut c, utc("2030-01-10T14:05:00Z"))
            .unwrap()
            .is_empty(),
        "fires once"
    );
}

#[test]
fn snoozed_reminders_fire_again_later() {
    let mut c = migrated_conn();
    items::create(&mut c, &timed("Stretch", FUTURE_START)).unwrap();
    let due = take_due(&mut c, utc("2030-01-10T14:00:00Z")).unwrap();
    let id = &due[0].reminder_id;

    let until = snooze(
        &mut c,
        id,
        Snooze::TenMinutes,
        &clock("2030-01-10T14:01:00Z"),
    )
    .unwrap();
    assert_eq!(until, utc("2030-01-10T14:11:00Z"));
    assert!(
        take_due(&mut c, utc("2030-01-10T14:10:00Z"))
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        take_due(&mut c, utc("2030-01-10T14:11:00Z")).unwrap().len(),
        1
    );

    // Tomorrow = 09:00 in the clock's zone (UTC+2) the next day.
    let until = snooze(&mut c, id, Snooze::Tomorrow, &clock("2030-01-10T14:12:00Z")).unwrap();
    assert_eq!(until, utc("2030-01-11T07:00:00Z"));
    assert!(matches!(
        snooze(
            &mut c,
            "missing",
            Snooze::OneHour,
            &clock("2030-01-10T14:12:00Z")
        ),
        Err(AppError::NotFound)
    ));
}

#[test]
fn rescheduling_starts_reminders_over_and_clears_snoozes() {
    let mut c = migrated_conn();
    let item = items::create(&mut c, &timed("Gym", FUTURE_START)).unwrap();
    let due = take_due(&mut c, utc("2030-01-10T14:00:00Z")).unwrap();
    snooze(
        &mut c,
        &due[0].reminder_id,
        Snooze::OneHour,
        &clock("2030-01-10T14:00:00Z"),
    )
    .unwrap();

    items::reschedule(
        &mut c,
        &item.id,
        &ScheduleInput {
            start_at: Some("2030-01-12T08:00:00.000Z".into()),
            ..ScheduleInput::default()
        },
    )
    .unwrap();
    let saved = &rows(&c, &item.id)[0];
    assert_eq!(saved.fire_at.as_deref(), Some("2030-01-12T08:00:00.000Z"));
    assert_eq!(saved.snoozed_until, None);
    assert_eq!(saved.fired_at, None, "it can fire again at the new moment");

    // Editing the title doesn't touch reminder timing.
    items::update(
        &mut c,
        &item.id,
        &timed("Gym (legs)", "2030-01-12T08:00:00.000Z"),
    )
    .unwrap();
    assert_eq!(rows(&c, &item.id)[0], *saved);
}

#[test]
fn waiting_reminders_follow_a_new_default_time() {
    let mut c = migrated_conn();
    let day = items::create(&mut c, &dated("Bins", FUTURE_DAY)).unwrap();
    items::create(&mut c, &timed("Timed", FUTURE_START)).unwrap();

    // First align with the test clock's zone (the item service used the machine's zone),
    // then change only the default time.
    recompute_waiting(&mut c, &clock("2029-12-01T00:00:00Z")).unwrap();
    let mut seven = clock("2029-12-01T00:00:00Z");
    seven.day_time = NaiveTime::from_hms_opt(7, 0, 0).unwrap();
    let changed = recompute_waiting(&mut c, &seven).unwrap();
    assert_eq!(
        changed, 1,
        "only the date-only reminder depends on the default time"
    );
    assert_eq!(
        rows(&c, &day.id)[0].fire_at.as_deref(),
        Some("2030-01-10T05:00:00.000Z")
    );
}

#[test]
fn next_fire_time_is_the_earliest_pending() {
    let mut c = migrated_conn();
    assert_eq!(next_fire_at(&c).unwrap(), None);
    items::create(&mut c, &timed("Later", "2030-02-01T10:00:00.000Z")).unwrap();
    items::create(&mut c, &timed("Sooner", FUTURE_START)).unwrap();
    assert_eq!(next_fire_at(&c).unwrap(), Some(utc(FUTURE_START)));
    take_due(&mut c, utc(FUTURE_START) + Duration::seconds(1)).unwrap();
    assert_eq!(next_fire_at(&c).unwrap(), Some(utc("2030-02-01T10:00:00Z")));
}
