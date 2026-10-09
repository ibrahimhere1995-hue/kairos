//! Repeating items through the real services, on an in-memory database. Date-only series
//! keep these tests independent of the machine's time zone.

use chrono::{Duration, NaiveDate, NaiveTime};

use super::*;
use crate::db::test_support::migrated_conn;
use crate::models::checklist::ChecklistEntryInput;
use crate::models::dashboard::DashboardQuery;
use crate::models::inputs::{DateRange, ItemFilters, ItemInput, ScheduleInput};
use crate::scheduler::timing::local_to_utc;
use crate::services::{checklist as steps, items, reminders as reminder_service, trash};

// Mondays in January 2030.
const MON1: &str = "2030-01-07";
const MON2: &str = "2030-01-14";
const MON3: &str = "2030-01-21";
const MON4: &str = "2030-01-28";

fn weekly(title: &str) -> ItemInput {
    ItemInput {
        kind: ItemKind::Task,
        title: title.into(),
        notes: None,
        area_id: None,
        priority: 0,
        start_at: None,
        end_at: None,
        due_date: Some(MON1.into()),
        location: None,
        source: None,
        reminders: Some(vec![]),
        rrule: Some("FREQ=WEEKLY".into()),
    }
}

fn day(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
}

fn utc_midnight(s: &str) -> String {
    reminders::iso(local_to_utc(&Local, day(s).and_time(NaiveTime::MIN)))
}

/// Everything shown between two local dates, sorted by date.
fn shown(c: &Connection, from: &str, to: &str) -> Vec<Item> {
    let range = DateRange {
        start: utc_midnight(from),
        end: utc_midnight(to),
        start_date: from.into(),
        end_date: to.into(),
    };
    let mut found = items::list(c, &range, &ItemFilters::default()).unwrap();
    found.sort_by(|a, b| a.due_date.cmp(&b.due_date));
    found
}

fn dates(found: &[Item]) -> Vec<&str> {
    found
        .iter()
        .map(|i| i.due_date.as_deref().unwrap_or(""))
        .collect()
}

fn occurrence(series_id: &str, key: &str) -> String {
    rule::occurrence_id(series_id, key)
}

fn series_of(c: &mut Connection) -> String {
    let first = items::create(c, &weekly("Bins")).unwrap();
    first
        .recurrence_parent_id
        .expect("shown as its first occurrence")
}

fn reason(err: AppError) -> &'static str {
    match err {
        AppError::Validation { reason, .. } => reason,
        other => panic!("expected a validation error, got {other:?}"),
    }
}

#[test]
fn a_series_shows_as_computed_occurrences() {
    let mut c = migrated_conn();
    let created = items::create(&mut c, &weekly("Bins")).unwrap();
    let id = created.recurrence_parent_id.clone().unwrap();
    assert_eq!(
        created.id,
        occurrence(&id, MON1),
        "create returns the first occurrence"
    );

    let found = shown(&c, MON1, "2030-01-22");
    assert_eq!(dates(&found), [MON1, MON2, MON3]);
    assert_eq!(found[1].id, occurrence(&id, MON2));
    assert!(
        found
            .iter()
            .all(|i| i.rrule.as_deref() == Some("FREQ=WEEKLY"))
    );
}

#[test]
fn rejects_bad_rules_and_repeats_without_a_date() {
    let mut c = migrated_conn();
    let bad = ItemInput {
        rrule: Some("FREQ=HOURLY".into()),
        ..weekly("X")
    };
    assert_eq!(
        reason(items::create(&mut c, &bad).unwrap_err()),
        "invalidRepeat"
    );
    let undated = ItemInput {
        due_date: None,
        ..weekly("X")
    };
    assert_eq!(
        reason(items::create(&mut c, &undated).unwrap_err()),
        "repeatNeedsDate"
    );
}

#[test]
fn completing_an_occurrence_stores_only_that_one() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    let done = items::complete(&mut c, &occurrence(&id, MON2)).unwrap();
    assert!(done.completed_at.is_some());
    assert_eq!(done.recurrence_parent_id.as_deref(), Some(id.as_str()));
    assert_eq!(done.original_start_at.as_deref(), Some(MON2));
    assert!(
        done.rrule.is_none(),
        "a stored occurrence doesn't repeat by itself"
    );

    let found = shown(&c, MON1, "2030-01-22");
    assert_eq!(
        dates(&found),
        [MON1, MON2, MON3],
        "no duplicate for the stored one"
    );
    assert_eq!(found[1].id, done.id);
    // Completing the same occurrence again reuses the stored one.
    assert_eq!(
        items::complete(&mut c, &occurrence(&id, MON2)).unwrap().id,
        done.id
    );
    assert!(
        items::uncomplete(&mut c, &done.id)
            .unwrap()
            .completed_at
            .is_none()
    );
}

#[test]
fn unknown_occurrences_are_not_found() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    assert!(matches!(
        items::complete(&mut c, &occurrence(&id, "2030-01-08")),
        Err(AppError::NotFound)
    ));
    assert!(matches!(
        items::complete(&mut c, &occurrence("nope", MON1)),
        Err(AppError::NotFound)
    ));
}

#[test]
fn moving_one_occurrence_leaves_the_others() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    let moved = items::reschedule(
        &mut c,
        &occurrence(&id, MON2),
        &ScheduleInput {
            due_date: Some("2030-01-16".into()),
            ..ScheduleInput::default()
        },
    )
    .unwrap();
    assert_eq!(moved.original_start_at.as_deref(), Some(MON2));
    assert_eq!(
        dates(&shown(&c, MON1, "2030-01-22")),
        [MON1, "2030-01-16", MON3]
    );
}

#[test]
fn deleting_only_this_one_and_restoring_it() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    items::delete_scoped(&mut c, &occurrence(&id, MON2), EditScope::This).unwrap();
    assert_eq!(dates(&shown(&c, MON1, "2030-01-22")), [MON1, MON3]);

    let in_trash = trash::list(&c).unwrap();
    assert_eq!(in_trash.len(), 1);
    items::restore(&mut c, &in_trash[0].id).unwrap();
    assert_eq!(dates(&shown(&c, MON1, "2030-01-22")), [MON1, MON2, MON3]);
}

#[test]
fn deleting_this_and_following() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    let early_done = items::complete(&mut c, &occurrence(&id, MON1)).unwrap();
    items::delete_scoped(&mut c, &occurrence(&id, MON3), EditScope::Following).unwrap();
    assert_eq!(
        dates(&shown(&c, MON1, "2030-02-05")),
        [MON1, MON2],
        "ends before the 3rd"
    );
    assert!(
        repo::get(&c, &early_done.id)
            .unwrap()
            .unwrap()
            .deleted_at
            .is_none(),
        "earlier history stays"
    );
}

#[test]
fn deleting_from_the_first_occurrence_trashes_the_series_and_restores_it_whole() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    items::complete(&mut c, &occurrence(&id, MON2)).unwrap();
    items::delete_scoped(&mut c, &occurrence(&id, MON1), EditScope::Following).unwrap();
    assert!(shown(&c, MON1, "2030-02-05").is_empty());

    let in_trash = trash::list(&c).unwrap();
    assert_eq!(
        in_trash.len(),
        1,
        "the series once, not each stored occurrence"
    );
    assert_eq!(in_trash[0].id, id);
    items::restore(&mut c, &id).unwrap();
    let back = shown(&c, MON1, "2030-01-22");
    assert_eq!(dates(&back), [MON1, MON2, MON3]);
    assert!(
        back[1].completed_at.is_some(),
        "its done occurrence came back too"
    );
}

#[test]
fn editing_only_this_one() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    let edited = items::update(
        &mut c,
        &occurrence(&id, MON2),
        &ItemInput {
            title: "Bins (recycling)".into(),
            due_date: Some(MON2.into()),
            ..weekly("ignored")
        },
    )
    .unwrap();
    assert_eq!(edited.title, "Bins (recycling)");
    let titles: Vec<String> = shown(&c, MON1, "2030-01-22")
        .into_iter()
        .map(|i| i.title)
        .collect();
    assert_eq!(titles, ["Bins", "Bins (recycling)", "Bins"]);
}

#[test]
fn editing_this_and_following_starts_a_new_series_with_the_steps() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    steps::set_checklist(
        &mut c,
        &occurrence(&id, MON1),
        &[ChecklistEntryInput {
            id: None,
            text: "Take out the bag".into(),
            done: false,
        }],
    )
    .unwrap();

    let renamed = items::update_scoped(
        &mut c,
        &occurrence(&id, MON3),
        &ItemInput {
            title: "Recycling".into(),
            due_date: Some(MON3.into()),
            ..weekly("ignored")
        },
        EditScope::Following,
    )
    .unwrap();
    let titles: Vec<String> = shown(&c, MON1, "2030-02-01")
        .into_iter()
        .map(|i| i.title)
        .collect();
    assert_eq!(titles, ["Bins", "Bins", "Recycling", "Recycling"]);
    let detail = steps::get_detail(&c, &renamed.id).unwrap();
    assert_eq!(detail.checklist.len(), 1, "steps carried over");
}

#[test]
fn changing_the_whole_series_timing_drops_open_stored_occurrences() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    let done = items::complete(&mut c, &occurrence(&id, MON2)).unwrap();
    let moved = items::reschedule(
        &mut c,
        &occurrence(&id, MON3),
        &ScheduleInput {
            due_date: Some("2030-01-23".into()),
            ..ScheduleInput::default()
        },
    )
    .unwrap();

    // From the first occurrence, "following" = the whole series: now on Tuesdays.
    items::update_scoped(
        &mut c,
        &occurrence(&id, MON1),
        &ItemInput {
            due_date: Some("2030-01-08".into()),
            ..weekly("Bins")
        },
        EditScope::Following,
    )
    .unwrap();
    assert!(
        repo::get(&c, &moved.id)
            .unwrap()
            .unwrap()
            .deleted_at
            .is_some(),
        "open one dropped"
    );
    assert!(
        repo::get(&c, &done.id)
            .unwrap()
            .unwrap()
            .deleted_at
            .is_none(),
        "history kept"
    );
    let found = shown(&c, "2030-01-08", "2030-01-30");
    assert!(dates(&found).contains(&"2030-01-08"));
    assert!(dates(&found).contains(&"2030-01-29"));
}

#[test]
fn turning_a_plain_task_into_a_series_and_back() {
    let mut c = migrated_conn();
    let plain = items::create(
        &mut c,
        &ItemInput {
            rrule: None,
            ..weekly("Stretch")
        },
    )
    .unwrap();
    let repeating = items::update(&mut c, &plain.id, &weekly("Stretch")).unwrap();
    assert_eq!(repeating.id, occurrence(&plain.id, MON1));
    assert_eq!(shown(&c, MON1, "2030-01-22").len(), 3);
    items::update_scoped(
        &mut c,
        &repeating.id,
        &ItemInput {
            rrule: None,
            ..weekly("Stretch")
        },
        EditScope::Following,
    )
    .unwrap();
    assert_eq!(
        dates(&shown(&c, MON1, "2030-01-22")),
        [MON1],
        "repeats no more"
    );
}

fn dashboard_on(date: &str) -> DashboardQuery {
    let next = day(date).succ_opt().unwrap();
    let week_end = day(date) + Duration::days(5);
    DashboardQuery {
        now: utc_midnight(date),
        day_start: utc_midnight(date),
        day_end: utc_midnight(&next.to_string()),
        today: date.into(),
        week_end: utc_midnight(&week_end.to_string()),
        week_end_date: week_end.to_string(),
    }
}

#[test]
fn only_the_latest_missed_occurrence_slips_and_the_week_shows_the_next_one() {
    let mut c = migrated_conn();
    let daily = items::create(
        &mut c,
        &ItemInput {
            rrule: Some("FREQ=DAILY".into()),
            ..weekly("Vitamins")
        },
    )
    .unwrap();
    let series_id = daily.recurrence_parent_id.unwrap();
    // The series has existed since before its first day.
    c.execute(
        "UPDATE items SET created_at = '2030-01-01T00:00:00.000Z' WHERE id = ?1",
        [&series_id],
    )
    .unwrap();

    let board = items::dashboard(&c, &dashboard_on("2030-01-10")).unwrap();
    let missed: Vec<&str> = board
        .overdue
        .iter()
        .filter_map(|i| i.original_start_at.as_deref())
        .collect();
    assert_eq!(
        missed,
        ["2030-01-09"],
        "only yesterday's, not the 7th and 8th"
    );
    assert_eq!(board.today.len(), 1);
    assert_eq!(board.this_week.len(), 1, "just the next one, not every day");
    assert_eq!(
        board.this_week[0].original_start_at.as_deref(),
        Some("2030-01-11")
    );

    // Once yesterday's is done, nothing slips.
    items::complete(&mut c, &occurrence(&series_id, "2030-01-09")).unwrap();
    let board = items::dashboard(&c, &dashboard_on("2030-01-10")).unwrap();
    assert!(board.overdue.is_empty());
}

#[test]
fn a_new_series_does_not_slip_before_it_existed() {
    let mut c = migrated_conn();
    items::create(&mut c, &weekly("Bins")).unwrap();
    // The series was only made on Tuesday the 15th: Monday the 14th can't have slipped.
    c.execute(
        "UPDATE items SET created_at = '2030-01-15T12:00:00.000Z'",
        [],
    )
    .unwrap();
    let board = items::dashboard(&c, &dashboard_on("2030-01-16")).unwrap();
    assert!(
        board.overdue.is_empty(),
        "the 14th was before the series existed"
    );
}

#[test]
fn reminders_follow_the_next_occurrence() {
    let mut c = migrated_conn();
    let first = items::create(
        &mut c,
        &ItemInput {
            reminders: Some(vec![0]),
            ..weekly("Bins")
        },
    )
    .unwrap();
    let series_id = first.recurrence_parent_id.unwrap();
    let nine = |d: &str| {
        local_to_utc(
            &Local,
            day(d).and_time(NaiveTime::from_hms_opt(9, 0, 0).unwrap()),
        )
    };

    let due = reminder_service::take_due(&mut c, nine(MON1)).unwrap();
    assert_eq!(due.len(), 1);
    assert_eq!(
        due[0].item_id,
        occurrence(&series_id, MON1),
        "Done acts on that occurrence"
    );
    assert_eq!(due[0].due_date.as_deref(), Some(MON1));
    assert!(
        reminder_service::take_due(&mut c, nine(MON1))
            .unwrap()
            .is_empty(),
        "once"
    );

    // The 14th was done early: its reminder is skipped, the 21st's comes next.
    items::complete(&mut c, &occurrence(&series_id, MON2)).unwrap();
    assert!(
        reminder_service::take_due(&mut c, nine(MON2))
            .unwrap()
            .is_empty()
    );
    let next = reminder_service::take_due(&mut c, nine(MON3)).unwrap();
    assert_eq!(next[0].item_id, occurrence(&series_id, MON3));
    let _ = MON4;
}

#[test]
fn an_occurrence_detail_shows_the_series_steps_and_reminders() {
    let mut c = migrated_conn();
    let first = items::create(
        &mut c,
        &ItemInput {
            reminders: Some(vec![0, 1440]),
            ..weekly("Bins")
        },
    )
    .unwrap();
    let series_id = first.recurrence_parent_id.clone().unwrap();
    let detail = steps::get_detail(&c, &occurrence(&series_id, MON3)).unwrap();
    assert_eq!(detail.item.due_date.as_deref(), Some(MON3));
    assert_eq!(detail.reminders, [0, 1440]);
}

#[test]
fn undo_after_deleting_an_occurrence_restores_it() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    items::delete(&mut c, &occurrence(&id, MON2)).unwrap();
    items::restore(&mut c, &occurrence(&id, MON2)).unwrap();
    assert_eq!(dates(&shown(&c, MON1, "2030-01-22")), [MON1, MON2, MON3]);
}

#[test]
fn a_stored_occurrence_shows_its_series_rule() {
    let mut c = migrated_conn();
    let id = series_of(&mut c);
    let done = items::complete(&mut c, &occurrence(&id, MON2)).unwrap();
    let detail = steps::get_detail(&c, &done.id).unwrap();
    assert_eq!(detail.item.rrule.as_deref(), Some("FREQ=WEEKLY"));
}
