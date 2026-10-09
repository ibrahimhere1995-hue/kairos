use super::*;
use crate::db::test_support::migrated_conn;
use crate::models::item::ItemKind;
use crate::services::seed::seed_defaults;

fn conn() -> Connection {
    let mut conn = migrated_conn();
    seed_defaults(&mut conn).unwrap();
    conn
}

fn first_area(conn: &Connection) -> String {
    conn.query_row(
        "SELECT id FROM areas ORDER BY sort_order LIMIT 1",
        [],
        |r| r.get(0),
    )
    .unwrap()
}

fn task(title: &str) -> ItemInput {
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
    }
}

fn dated(title: &str, due: &str) -> ItemInput {
    ItemInput {
        due_date: Some(due.into()),
        ..task(title)
    }
}

fn timed(title: &str, start: &str) -> ItemInput {
    ItemInput {
        start_at: Some(start.into()),
        ..task(title)
    }
}

fn event(title: &str, start: &str, end: &str) -> ItemInput {
    ItemInput {
        kind: ItemKind::Event,
        start_at: Some(start.into()),
        end_at: Some(end.into()),
        ..task(title)
    }
}

fn validation(err: AppError) -> (&'static str, &'static str) {
    match err {
        AppError::Validation { field, reason } => (field, reason),
        other => panic!("expected validation error, got {other:?}"),
    }
}

fn titles(items: &[Item]) -> Vec<&str> {
    items.iter().map(|i| i.title.as_str()).collect()
}

// ---------- create ----------

#[test]
fn creates_a_date_only_task_with_defaults() {
    let mut c = conn();
    let area = first_area(&c);
    let item = create(
        &mut c,
        &ItemInput {
            area_id: Some(area.clone()),
            priority: 3,
            ..dated("  Call bank  ", "2026-10-08")
        },
    )
    .unwrap();

    assert_eq!(item.title, "Call bank", "title is trimmed");
    assert!(item.all_day);
    assert_eq!(item.due_date.as_deref(), Some("2026-10-08"));
    assert_eq!(item.area_id, Some(area));
    assert_eq!(item.priority, 3);
    assert_eq!(item.reschedule_count, 0);
    assert_eq!(item.source, ItemSource::Manual);
    assert_eq!(repo::get(&c, &item.id).unwrap(), Some(item));
}

#[test]
fn creates_a_timed_event_in_utc() {
    let mut c = conn();
    let item = create(
        &mut c,
        &event(
            "Standup",
            "2026-10-07T09:00:00+02:00",
            "2026-10-07T09:15:00+02:00",
        ),
    )
    .unwrap();
    assert!(!item.all_day);
    assert_eq!(item.start_at.as_deref(), Some("2026-10-07T07:00:00.000Z"));
    assert_eq!(item.end_at.as_deref(), Some("2026-10-07T07:15:00.000Z"));
}

#[test]
fn unscheduled_task_goes_to_inbox() {
    let mut c = conn();
    let item = create(&mut c, &task("Idea")).unwrap();
    assert!(item.start_at.is_none() && item.due_date.is_none() && !item.all_day);
}

#[test]
fn rejects_invalid_input() {
    let mut c = conn();
    assert_eq!(
        validation(create(&mut c, &task("   ")).unwrap_err()),
        ("title", "required")
    );
    assert_eq!(
        validation(create(&mut c, &task(&"x".repeat(501))).unwrap_err()),
        ("title", "tooLong")
    );
    assert_eq!(
        validation(
            create(
                &mut c,
                &ItemInput {
                    priority: 4,
                    ..task("t")
                }
            )
            .unwrap_err()
        ),
        ("priority", "outOfRange")
    );
    assert_eq!(
        validation(
            create(
                &mut c,
                &ItemInput {
                    area_id: Some("nope".into()),
                    ..task("t")
                }
            )
            .unwrap_err()
        ),
        ("areaId", "unknownArea")
    );
    let count: i64 = c
        .query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0, "nothing is written when validation fails");
}

// ---------- update & reschedule ----------

#[test]
fn update_replaces_fields() {
    let mut c = conn();
    let item = create(&mut c, &dated("Old", "2026-10-08")).unwrap();
    let updated = update(
        &mut c,
        &item.id,
        &ItemInput {
            notes: Some("bring ID".into()),
            location: Some(" Bank ".into()),
            ..dated("New", "2026-10-08")
        },
    )
    .unwrap();
    assert_eq!(updated.title, "New");
    assert_eq!(updated.notes.as_deref(), Some("bring ID"));
    assert_eq!(updated.location.as_deref(), Some("Bank"));
    assert_eq!(updated.reschedule_count, 0, "same date is not a reschedule");
    assert_eq!(updated.created_at, item.created_at);
}

#[test]
fn moving_a_scheduled_item_increments_reschedule_count() {
    let mut c = conn();
    let item = create(&mut c, &dated("Report", "2026-10-08")).unwrap();

    let moved = reschedule(
        &mut c,
        &item.id,
        &ScheduleInput {
            due_date: Some("2026-10-09".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(moved.reschedule_count, 1);

    let moved = update(&mut c, &item.id, &timed("Report", "2026-10-10T08:00:00Z")).unwrap();
    assert_eq!(
        moved.reschedule_count, 2,
        "editing the date in the editor also counts"
    );
    assert!(!moved.all_day, "date-only → timed clears all_day");

    let moved = reschedule(
        &mut c,
        &item.id,
        &ScheduleInput {
            start_at: Some("2026-10-11T08:00:00Z".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(moved.reschedule_count, 3);
    assert_eq!(
        repo::get(&c, &item.id).unwrap().unwrap().reschedule_count,
        3,
        "persisted"
    );
}

#[test]
fn first_date_for_an_inbox_item_is_not_a_reschedule() {
    let mut c = conn();
    let item = create(&mut c, &task("Idea")).unwrap();
    let scheduled = reschedule(
        &mut c,
        &item.id,
        &ScheduleInput {
            due_date: Some("2026-10-08".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(scheduled.reschedule_count, 0);
    assert!(scheduled.all_day);
}

#[test]
fn rescheduling_an_event_still_requires_an_end() {
    let mut c = conn();
    let item = create(
        &mut c,
        &event("Meeting", "2026-10-07T09:00:00Z", "2026-10-07T10:00:00Z"),
    )
    .unwrap();
    let err = reschedule(
        &mut c,
        &item.id,
        &ScheduleInput {
            start_at: Some("2026-10-08T09:00:00Z".into()),
            ..Default::default()
        },
    )
    .unwrap_err();
    assert_eq!(validation(err), ("endAt", "eventNeedsEnd"));
}

// ---------- complete ----------

#[test]
fn complete_and_uncomplete() {
    let mut c = conn();
    let item = create(&mut c, &dated("Gym", "2026-10-07")).unwrap();

    let done = complete(&mut c, &item.id).unwrap();
    let first_done_at = done.completed_at.clone().unwrap();

    let again = complete(&mut c, &item.id).unwrap();
    assert_eq!(
        again.completed_at.as_deref(),
        Some(first_done_at.as_str()),
        "idempotent"
    );

    let undone = uncomplete(&mut c, &item.id).unwrap();
    assert!(undone.completed_at.is_none());
}

// ---------- delete & restore ----------

#[test]
fn delete_is_soft_and_restorable() {
    let mut c = conn();
    let item = create(&mut c, &dated("Bills", "2026-10-07")).unwrap();

    delete(&mut c, &item.id).unwrap();
    let stored = repo::get(&c, &item.id).unwrap().expect("row still exists");
    assert!(stored.deleted_at.is_some());

    assert!(
        matches!(complete(&mut c, &item.id), Err(AppError::NotFound)),
        "trashed items are read-only"
    );
    assert!(matches!(delete(&mut c, &item.id), Err(AppError::NotFound)));

    let restored = restore(&mut c, &item.id).unwrap();
    assert!(restored.deleted_at.is_none());
    assert!(complete(&mut c, &item.id).is_ok());
}

#[test]
fn unknown_ids_are_not_found() {
    let mut c = conn();
    assert!(matches!(
        complete(&mut c, "missing"),
        Err(AppError::NotFound)
    ));
    assert!(matches!(
        restore(&mut c, "missing"),
        Err(AppError::NotFound)
    ));
}

// ---------- list by range ----------

fn day_range(date: &str, next: &str) -> DateRange {
    DateRange {
        start: format!("{date}T00:00:00Z"),
        end: format!("{next}T00:00:00Z"),
        start_date: date.into(),
        end_date: next.into(),
    }
}

#[test]
fn list_returns_only_items_overlapping_the_range() {
    let mut c = conn();
    create(&mut c, &dated("Today date-only", "2026-10-07")).unwrap();
    create(&mut c, &dated("Tomorrow date-only", "2026-10-08")).unwrap();
    create(&mut c, &timed("Morning task", "2026-10-07T08:00:00Z")).unwrap();
    create(
        &mut c,
        &event("Late event", "2026-10-07T23:30:00Z", "2026-10-08T00:30:00Z"),
    )
    .unwrap();
    create(
        &mut c,
        &event(
            "Ended at midnight",
            "2026-10-06T23:00:00Z",
            "2026-10-07T00:00:00Z",
        ),
    )
    .unwrap();
    create(
        &mut c,
        &event(
            "Starts at end",
            "2026-10-08T00:00:00Z",
            "2026-10-08T01:00:00Z",
        ),
    )
    .unwrap();
    create(&mut c, &task("Inbox idea")).unwrap();
    let deleted = create(&mut c, &dated("Deleted", "2026-10-07")).unwrap();
    delete(&mut c, &deleted.id).unwrap();

    let items = list(
        &c,
        &day_range("2026-10-07", "2026-10-08"),
        &ItemFilters::default(),
    )
    .unwrap();
    let mut got = titles(&items);
    got.sort_unstable();
    assert_eq!(got, ["Late event", "Morning task", "Today date-only"]);
}

#[test]
fn list_includes_completed_items_and_filters_by_area() {
    let mut c = conn();
    let area = first_area(&c);
    let a = create(
        &mut c,
        &ItemInput {
            area_id: Some(area.clone()),
            ..dated("Work thing", "2026-10-07")
        },
    )
    .unwrap();
    create(&mut c, &dated("No area", "2026-10-07")).unwrap();
    complete(&mut c, &a.id).unwrap();

    let all = list(
        &c,
        &day_range("2026-10-07", "2026-10-08"),
        &ItemFilters::default(),
    )
    .unwrap();
    assert_eq!(all.len(), 2, "calendar shows done items too");

    let filtered = list(
        &c,
        &day_range("2026-10-07", "2026-10-08"),
        &ItemFilters {
            area_ids: vec![area],
        },
    )
    .unwrap();
    assert_eq!(titles(&filtered), ["Work thing"]);
}

#[test]
fn list_rejects_backwards_ranges() {
    let c = conn();
    let err = list(
        &c,
        &day_range("2026-10-08", "2026-10-07"),
        &ItemFilters::default(),
    )
    .unwrap_err();
    assert_eq!(validation(err), ("end", "beforeStart"));
}

// ---------- dashboard ----------

/// User in UTC+2: local day 2026-10-07 is 2026-10-06T22:00Z .. 2026-10-07T22:00Z.
fn dashboard_query() -> DashboardQuery {
    DashboardQuery {
        now: "2026-10-07T10:00:00Z".into(),
        day_start: "2026-10-06T22:00:00Z".into(),
        day_end: "2026-10-07T22:00:00Z".into(),
        today: "2026-10-07".into(),
        week_end: "2026-10-11T22:00:00Z".into(),
        week_end_date: "2026-10-12".into(),
    }
}

#[test]
fn dashboard_groups_items_by_time_window() {
    let mut c = conn();
    create(&mut c, &dated("Today task", "2026-10-07")).unwrap();
    create(
        &mut c,
        &timed("Early local morning", "2026-10-06T22:30:00Z"),
    )
    .unwrap(); // 00:30 local today
    create(
        &mut c,
        &event(
            "Meeting now",
            "2026-10-07T09:30:00Z",
            "2026-10-07T10:30:00Z",
        ),
    )
    .unwrap();
    create(&mut c, &dated("Yesterday task", "2026-10-06")).unwrap();
    create(
        &mut c,
        &timed("Late yesterday local", "2026-10-06T21:00:00Z"),
    )
    .unwrap(); // 23:00 local yesterday
    create(
        &mut c,
        &event(
            "Yesterday meeting",
            "2026-10-06T08:00:00Z",
            "2026-10-06T09:00:00Z",
        ),
    )
    .unwrap();
    create(&mut c, &dated("Friday task", "2026-10-09")).unwrap();
    create(&mut c, &dated("Next week task", "2026-10-13")).unwrap();
    let done = create(&mut c, &dated("Done today", "2026-10-07")).unwrap();
    complete(&mut c, &done.id).unwrap();
    let trashed = create(&mut c, &dated("Trashed overdue", "2026-10-01")).unwrap();
    delete(&mut c, &trashed.id).unwrap();

    // Completion time is "now" (real clock); query a day around it for done_today.
    let mut query = dashboard_query();
    let completed_at = repo::get(&c, &done.id)
        .unwrap()
        .unwrap()
        .completed_at
        .unwrap();
    let half_day = chrono::Duration::hours(12);
    let at = chrono::DateTime::parse_from_rfc3339(&completed_at).unwrap();
    query.day_start = (at - half_day).to_rfc3339();
    query.day_end = (at + half_day).to_rfc3339();
    let done_today = dashboard(&c, &query).unwrap().done_today;
    assert_eq!(titles(&done_today), ["Done today"]);

    let d = dashboard(&c, &dashboard_query()).unwrap();
    assert_eq!(
        titles(&d.today),
        ["Early local morning", "Meeting now", "Today task"]
    );
    // Ordered by date; a date-only item sorts before timed items on the same date.
    assert_eq!(
        titles(&d.overdue),
        ["Yesterday task", "Late yesterday local"],
        "events never slip"
    );
    assert_eq!(titles(&d.this_week), ["Friday task"]);
}

#[test]
fn skipped_and_completed_items_are_not_overdue() {
    let mut c = conn();
    let t = create(&mut c, &dated("Old", "2026-10-01")).unwrap();
    complete(&mut c, &t.id).unwrap();
    let d = dashboard(&c, &dashboard_query()).unwrap();
    assert!(d.overdue.is_empty());
}

#[test]
fn reschedule_many_moves_all_or_nothing() {
    let mut c = conn();
    let a = create(&mut c, &dated("A", "2026-10-01")).unwrap();
    let b = create(&mut c, &timed("B", "2026-10-02T09:00:00Z")).unwrap();
    let today = ScheduleInput {
        due_date: Some("2026-10-08".into()),
        ..ScheduleInput::default()
    };
    let moved = reschedule_many(&mut c, &[a.id.clone(), b.id.clone()], &today).unwrap();
    assert_eq!(moved.len(), 2);
    for item in &moved {
        assert_eq!(item.due_date.as_deref(), Some("2026-10-08"));
        assert_eq!(item.start_at, None);
        assert_eq!(item.reschedule_count, 1);
    }

    // One unknown id: nothing moves.
    let tomorrow = ScheduleInput {
        due_date: Some("2026-10-09".into()),
        ..ScheduleInput::default()
    };
    assert!(matches!(
        reschedule_many(&mut c, &[a.id.clone(), "missing".into()], &tomorrow),
        Err(AppError::NotFound)
    ));
    let a_now = repo::get(&c, &a.id).unwrap().unwrap();
    assert_eq!(a_now.due_date.as_deref(), Some("2026-10-08"), "rolled back");

    let too_many: Vec<String> = (0..=MAX_BULK).map(|i| i.to_string()).collect();
    assert!(reschedule_many(&mut c, &too_many, &tomorrow).is_err());
}

#[test]
fn skip_sets_a_task_aside_and_unskip_brings_it_back() {
    let mut c = conn();
    let item = create(&mut c, &dated("Old idea", "2026-10-01")).unwrap();
    let skipped = skip(&mut c, &item.id).unwrap();
    assert!(skipped.skipped_at.is_some());
    assert!(skipped.deleted_at.is_none(), "letting go is not deleting");
    let first = skipped.skipped_at.clone();
    assert_eq!(
        skip(&mut c, &item.id).unwrap().skipped_at,
        first,
        "skipping twice keeps the time"
    );

    let back = unskip(&mut c, &item.id).unwrap();
    assert!(back.skipped_at.is_none());

    // Completing clears a skip, and skipping clears a completion.
    skip(&mut c, &item.id).unwrap();
    assert!(complete(&mut c, &item.id).unwrap().skipped_at.is_none());
    assert!(skip(&mut c, &item.id).unwrap().completed_at.is_none());
}

#[test]
fn unscheduled_lists_open_inbox_tasks_newest_first() {
    let mut c = conn();
    create(&mut c, &task("Older idea")).unwrap();
    create(&mut c, &task("Newer idea")).unwrap();
    create(&mut c, &dated("Dated", "2026-10-08")).unwrap();
    let done = create(&mut c, &task("Done idea")).unwrap();
    complete(&mut c, &done.id).unwrap();
    let trashed = create(&mut c, &task("Trashed idea")).unwrap();
    delete(&mut c, &trashed.id).unwrap();

    assert_eq!(
        titles(&unscheduled(&c).unwrap()),
        ["Newer idea", "Older idea"]
    );
}
