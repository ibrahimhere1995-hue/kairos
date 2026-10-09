use chrono::NaiveDateTime;

use super::*;
use crate::models::item::{ItemKind, ItemSource};
use crate::scheduler::timing::tests::London;

fn local(s: &str) -> NaiveDateTime {
    parse_key(s).unwrap()
}

fn series(start_at: Option<&str>, end_at: Option<&str>, due: Option<&str>, rule: &str) -> Item {
    Item {
        id: "s1".into(),
        kind: ItemKind::Task,
        title: "Water plants".into(),
        notes: None,
        area_id: None,
        priority: 0,
        all_day: due.is_some(),
        start_at: start_at.map(Into::into),
        end_at: end_at.map(Into::into),
        due_date: due.map(Into::into),
        completed_at: None,
        skipped_at: None,
        location: None,
        rrule: Some(rule.into()),
        recurrence_parent_id: None,
        original_start_at: None,
        milestone_id: None,
        reschedule_count: 0,
        source: ItemSource::Manual,
        created_at: "2026-01-01T00:00:00.000Z".into(),
        updated_at: "2026-01-01T00:00:00.000Z".into(),
        deleted_at: None,
    }
}

#[test]
fn accepts_daily_weekly_monthly_yearly_rules_only() {
    assert_eq!(
        normalize_rule("freq=weekly;byday=mo,we").unwrap(),
        "FREQ=WEEKLY;BYDAY=MO,WE"
    );
    assert_eq!(
        normalize_rule("RRULE:FREQ=DAILY;INTERVAL=2").unwrap(),
        "FREQ=DAILY;INTERVAL=2"
    );
    assert!(normalize_rule("FREQ=MONTHLY;BYMONTHDAY=-1").is_ok());
    assert!(normalize_rule("FREQ=YEARLY;COUNT=5").is_ok());
    assert_eq!(normalize_rule("FREQ=HOURLY"), Err(RuleError::Unsupported));
    assert_eq!(
        normalize_rule("FREQ=DAILY;BYHOUR=9"),
        Err(RuleError::Unsupported)
    );
    assert_eq!(normalize_rule("every monday"), Err(RuleError::Invalid));
    assert_eq!(normalize_rule(""), Err(RuleError::Invalid));
    assert_eq!(
        normalize_rule("FREQ=DAILY\nDTSTART:20260101T000000Z"),
        Err(RuleError::Invalid)
    );
}

#[test]
fn expands_within_a_window_inclusive() {
    let start = local("2026-10-05"); // a Monday
    let got = occurrences(
        "FREQ=WEEKLY;BYDAY=MO,WE",
        start,
        local("2026-10-07"),
        local("2026-10-14"),
    )
    .unwrap();
    assert_eq!(
        got,
        [
            local("2026-10-07"),
            local("2026-10-12"),
            local("2026-10-14")
        ]
    );
    assert!(
        occurrences(
            "FREQ=DAILY",
            start,
            local("2026-10-09"),
            local("2026-10-08")
        )
        .unwrap()
        .is_empty()
    );
}

#[test]
fn count_and_until_end_a_series() {
    let start = local("2026-10-01");
    let count = occurrences("FREQ=DAILY;COUNT=3", start, start, local("2026-12-31")).unwrap();
    assert_eq!(count.len(), 3);
    let until = occurrences(
        "FREQ=DAILY;UNTIL=20261003T235959Z",
        start,
        start,
        local("2026-12-31"),
    )
    .unwrap();
    assert_eq!(until.last(), Some(&local("2026-10-03")));
}

#[test]
fn monthly_on_the_31st_skips_short_months() {
    let start = local("2026-01-31");
    let got = occurrences("FREQ=MONTHLY", start, start, local("2026-05-31")).unwrap();
    assert_eq!(
        got,
        [
            local("2026-01-31"),
            local("2026-03-31"),
            local("2026-05-31")
        ]
    );
}

#[test]
fn timed_occurrences_keep_the_local_time_across_dst() {
    // Every day at 09:00 London time, from Sat 24 Oct (BST, 08:00Z).
    let s = series(
        Some("2026-10-24T08:00:00.000Z"),
        Some("2026-10-24T08:30:00.000Z"),
        None,
        "FREQ=DAILY",
    );
    let start = series_start(&London, &s).unwrap();
    assert_eq!(start, local("2026-10-24T09:00"));
    let days = occurrences("FREQ=DAILY", start, start, local("2026-10-26T23:59")).unwrap();
    let items: Vec<Item> = days
        .iter()
        .map(|d| occurrence_item(&London, &s, *d))
        .collect();
    let starts: Vec<&str> = items
        .iter()
        .map(|i| i.start_at.as_deref().unwrap())
        .collect();
    assert_eq!(
        starts,
        [
            "2026-10-24T08:00:00.000Z",
            "2026-10-25T09:00:00.000Z",
            "2026-10-26T09:00:00.000Z"
        ],
        "09:00 BST, then 09:00 GMT"
    );
    assert_eq!(
        items[1].end_at.as_deref(),
        Some("2026-10-25T09:30:00.000Z"),
        "keeps its length"
    );
    assert_eq!(items[1].id, "s1@2026-10-25T09:00");
    assert_eq!(
        items[1].original_start_at.as_deref(),
        Some("2026-10-25T09:00")
    );
    assert_eq!(items[1].recurrence_parent_id.as_deref(), Some("s1"));
}

#[test]
fn date_only_occurrences_use_dates() {
    let s = series(None, None, Some("2026-10-05"), "FREQ=WEEKLY");
    let start = series_start(&London, &s).unwrap();
    let next = occurrences(
        "FREQ=WEEKLY",
        start,
        local("2026-10-06"),
        local("2026-10-13"),
    )
    .unwrap();
    let item = occurrence_item(&London, &s, next[0]);
    assert_eq!(item.due_date.as_deref(), Some("2026-10-12"));
    assert_eq!(item.start_at, None);
    assert_eq!(item.id, "s1@2026-10-12");
}

#[test]
fn latest_occurrence_before_a_moment() {
    let start = local("2026-10-01");
    let at = local("2026-10-09T00:00");
    let latest = latest_before("FREQ=WEEKLY;BYDAY=MO", start, at, Duration::days(400)).unwrap();
    assert_eq!(latest, Some(local("2026-10-05")));
    assert_eq!(
        latest_before("FREQ=DAILY", local("2026-11-01"), at, Duration::days(400)).unwrap(),
        None,
        "series that hasn't started"
    );
}

#[test]
fn occurrence_ids_and_keys_round_trip() {
    assert_eq!(
        split_occurrence_id("abc@2026-10-12"),
        Some(("abc", "2026-10-12"))
    );
    assert_eq!(split_occurrence_id("plain-id"), None);
    assert_eq!(
        parse_key("2026-10-12T09:30"),
        Some(local("2026-10-12T09:30"))
    );
    assert_eq!(parse_key("nonsense"), None);
}

#[test]
fn splitting_ends_the_old_series_just_before() {
    assert_eq!(
        ending_before("FREQ=WEEKLY;BYDAY=MO;COUNT=10", local("2026-10-12")),
        "FREQ=WEEKLY;BYDAY=MO;UNTIL=20261011T235959Z"
    );
    assert_eq!(
        ending_before(
            "FREQ=DAILY;UNTIL=20270101T000000Z",
            local("2026-10-12T09:00")
        ),
        "FREQ=DAILY;UNTIL=20261012T085959Z"
    );
    let start = local("2026-10-05");
    let ended = ending_before("FREQ=WEEKLY", local("2026-10-19"));
    let left = occurrences(&ended, start, start, local("2027-01-01")).unwrap();
    assert_eq!(left, [local("2026-10-05"), local("2026-10-12")]);
}
