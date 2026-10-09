use chrono::FixedOffset;

use super::*;
use crate::models::item::ItemSource;
use crate::scheduler::timing::tests::London;

fn item(fields: impl FnOnce(&mut Item)) -> Item {
    let mut item = Item {
        id: "i1".into(),
        kind: ItemKind::Event,
        title: "Lunch".into(),
        notes: None,
        area_id: None,
        priority: 0,
        all_day: false,
        start_at: Some("2026-10-12T11:00:00.000Z".into()),
        end_at: Some("2026-10-12T12:00:00.000Z".into()),
        due_date: None,
        completed_at: None,
        skipped_at: None,
        location: None,
        rrule: None,
        recurrence_parent_id: None,
        original_start_at: None,
        milestone_id: None,
        reschedule_count: 0,
        source: ItemSource::Manual,
        created_at: "2026-10-01T00:00:00.000Z".into(),
        updated_at: "2026-10-01T00:00:00.000Z".into(),
        deleted_at: None,
    };
    fields(&mut item);
    item
}

fn now() -> DateTime<Utc> {
    DateTime::parse_from_rfc3339("2026-10-09T08:00:00Z")
        .unwrap()
        .with_timezone(&Utc)
}

fn utc() -> FixedOffset {
    FixedOffset::east_opt(0).unwrap()
}

#[test]
fn escapes_and_folds_long_lines() {
    assert_eq!(escape_text("a;b,c\\d\ne"), "a\\;b\\,c\\\\d\\ne");
    let long = format!("SUMMARY:{}", "é".repeat(60));
    let folded = fold(&long);
    for line in folded.split("\r\n").filter(|l| !l.is_empty()) {
        assert!(line.len() <= 75, "{} octets", line.len());
    }
    assert_eq!(
        unfold(&folded).trim_end(),
        long,
        "unfolds back to the same text"
    );
}

#[test]
fn writes_events_tasks_and_series() {
    let lunch = item(|i| {
        i.notes = Some("Bring, the; notes".into());
        i.location = Some("Café".into());
    });
    let bills = item(|i| {
        i.id = "t1".into();
        i.kind = ItemKind::Task;
        i.title = "Pay bills".into();
        i.start_at = None;
        i.end_at = None;
        i.due_date = Some("2026-10-14".into());
        i.completed_at = Some("2026-10-13T09:00:00.000Z".into());
    });
    let gym = item(|i| {
        i.id = "s1".into();
        i.title = "Gym".into();
        i.start_at = Some("2026-10-12T08:00:00.000Z".into()); // 09:00 BST
        i.end_at = Some("2026-10-12T09:00:00.000Z".into());
        i.rrule = Some("FREQ=WEEKLY;UNTIL=20261231T235959Z".into());
    });
    let text = write_calendar(
        &London,
        &[
            (lunch, vec![]),
            (bills, vec![]),
            (gym, vec!["2026-10-19T09:00".into()]),
        ],
        now(),
    );
    assert!(text.starts_with("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
    assert!(text.ends_with("END:VCALENDAR\r\n"));
    assert!(text.contains("DTSTART:20261012T110000Z\r\nDTEND:20261012T120000Z"));
    assert!(text.contains("DESCRIPTION:Bring\\, the\\; notes"));
    assert!(text.contains("LOCATION:Café"));
    assert!(text.contains("BEGIN:VTODO") && text.contains("DTSTART;VALUE=DATE:20261014"));
    assert!(text.contains("STATUS:COMPLETED"));
    // The series in floating local time, so other apps keep 09:00 across DST.
    assert!(text.contains("DTSTART:20261012T090000\r\n"));
    assert!(text.contains("RRULE:FREQ=WEEKLY;UNTIL=20261231T235959\r\n"));
    assert!(text.contains("EXDATE:20261019T090000"));
}

#[test]
fn reads_back_what_it_writes() {
    let lunch = item(|i| i.location = Some("Café, upstairs".into()));
    let text = write_calendar(&utc(), &[(lunch.clone(), vec![])], now());
    let read = read(&utc(), &text).unwrap();
    assert_eq!(read.skipped, 0);
    let entry = &read.entries[0];
    assert_eq!(entry.title, "Lunch");
    assert_eq!(entry.kind, ItemKind::Event);
    assert_eq!(entry.start_at, lunch.start_at);
    assert_eq!(entry.end_at, lunch.end_at);
    assert_eq!(entry.location.as_deref(), Some("Café, upstairs"));
}

const OTHER_APP: &str = "BEGIN:VCALENDAR\r
PRODID:-//Google Inc//Google Calendar 70.9054//EN\r
VERSION:2.0\r
BEGIN:VTIMEZONE\r
TZID:Europe/London\r
END:VTIMEZONE\r
BEGIN:VEVENT\r
DTSTART;TZID=Europe/London:20261026T090000\r
DTEND;TZID=Europe/London:20261026T093000\r
RRULE:FREQ=WEEKLY;BYDAY=MO\r
SUMMARY:Standup\r
DESCRIPTION:Line one\\nLine two\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;VALUE=DATE:20261225\r
DTEND;VALUE=DATE:20261226\r
SUMMARY:Christmas\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART:20261101T100000Z\r
DURATION:PT1H30M\r
SUMMARY:Long talk\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART:20261102T100000Z\r
SUMMARY:Cancelled thing\r
STATUS:CANCELLED\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART:20261102T100000Z\r
RECURRENCE-ID;TZID=Europe/London:20261102T090000\r
SUMMARY:Standup (moved)\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART:20261103T100000Z\r
RRULE:FREQ=HOURLY\r
SUMMARY:Hourly ping\r
END:VEVENT\r
BEGIN:VTODO\r
SUMMARY:Buy stamps\r
END:VTODO\r
END:VCALENDAR\r
";

#[test]
fn reads_files_from_other_calendar_apps() {
    let read = read(&utc(), OTHER_APP).unwrap();
    assert_eq!(read.skipped, 2, "cancelled + a changed single occurrence");
    assert_eq!(read.simplified, 1, "hourly can't repeat in Kairos");
    let titles: Vec<&str> = read.entries.iter().map(|e| e.title.as_str()).collect();
    assert_eq!(
        titles,
        [
            "Standup",
            "Christmas",
            "Long talk",
            "Hourly ping",
            "Buy stamps"
        ]
    );

    let standup = &read.entries[0];
    // 26 Oct 09:00 London is GMT (after the change): 09:00Z.
    assert_eq!(
        standup.start_at.as_deref(),
        Some("2026-10-26T09:00:00.000Z")
    );
    assert_eq!(standup.end_at.as_deref(), Some("2026-10-26T09:30:00.000Z"));
    assert_eq!(standup.rrule.as_deref(), Some("FREQ=WEEKLY;BYDAY=MO"));
    assert_eq!(standup.notes.as_deref(), Some("Line one\nLine two"));

    assert_eq!(read.entries[1].due_date.as_deref(), Some("2026-12-25"));
    assert_eq!(
        read.entries[2].end_at.as_deref(),
        Some("2026-11-01T11:30:00.000Z")
    );
    assert_eq!(read.entries[3].rrule, None);
    let todo = &read.entries[4];
    assert_eq!(
        (
            todo.kind,
            todo.start_at.as_deref(),
            todo.due_date.as_deref()
        ),
        (ItemKind::Task, None, None)
    );
}

#[test]
fn floating_times_use_this_computers_zone_and_events_get_an_end() {
    let file = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260701T090000\r\nSUMMARY:Local\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    let read = read(&London, file).unwrap();
    assert_eq!(
        read.entries[0].start_at.as_deref(),
        Some("2026-07-01T08:00:00.000Z"),
        "09:00 BST"
    );
    assert_eq!(
        read.entries[0].end_at.as_deref(),
        Some("2026-07-01T09:00:00.000Z"),
        "an hour by default"
    );
}

#[test]
fn durations() {
    assert_eq!(duration("PT1H30M"), Some(Duration::minutes(90)));
    assert_eq!(duration("P1DT2H"), Some(Duration::hours(26)));
    assert_eq!(duration("P2W"), Some(Duration::weeks(2)));
    assert_eq!(duration("nonsense"), None);
    assert_eq!(duration("P1X"), None);
}

#[test]
fn rejects_non_calendar_text_without_panicking() {
    assert!(
        read(&utc(), "not a calendar at all").is_err()
            || read(&utc(), "not a calendar at all")
                .unwrap()
                .entries
                .is_empty()
    );
    assert!(read(&utc(), "BEGIN:").is_err());
    let no_title = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20261101T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    let read = read(&utc(), no_title).unwrap();
    assert!(!read.entries[0].title.is_empty());
}
