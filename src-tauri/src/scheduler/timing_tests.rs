use chrono::{FixedOffset, NaiveDate, NaiveDateTime, NaiveTime, Offset, TimeZone, Utc};

use super::*;

/// A London-like zone for 2026: UTC+0, and UTC+1 (summer time) from 29 Mar 01:00 UTC
/// (clocks jump 01:00 → 02:00) to 25 Oct 01:00 UTC (clocks fall back 02:00 → 01:00).
/// Hand-built so DST tests don't depend on the machine's time zone.
#[derive(Debug, Clone, Copy)]
pub(crate) struct London;

fn utc(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
}

fn is_summer(utc_naive: &NaiveDateTime) -> bool {
    let start = utc("2026-03-29T01:00:00Z").naive_utc();
    let end = utc("2026-10-25T01:00:00Z").naive_utc();
    *utc_naive >= start && *utc_naive < end
}

fn offset_hours(h: i32) -> FixedOffset {
    FixedOffset::east_opt(h * 3600).unwrap()
}

impl TimeZone for London {
    type Offset = FixedOffset;

    fn from_offset(_: &FixedOffset) -> Self {
        London
    }

    fn offset_from_local_date(&self, local: &NaiveDate) -> LocalResult<FixedOffset> {
        self.offset_from_local_datetime(&local.and_hms_opt(12, 0, 0).unwrap())
    }

    fn offset_from_local_datetime(&self, local: &NaiveDateTime) -> LocalResult<FixedOffset> {
        // Which offsets map this wall-clock time back onto itself? Summer (+1) gives the earlier instant.
        let summer = is_summer(&(*local - Duration::hours(1)));
        let winter = !is_summer(local);
        match (summer, winter) {
            (true, true) => LocalResult::Ambiguous(offset_hours(1), offset_hours(0)),
            (true, false) => LocalResult::Single(offset_hours(1)),
            (false, true) => LocalResult::Single(offset_hours(0)),
            (false, false) => LocalResult::None,
        }
    }

    fn offset_from_utc_date(&self, utc: &NaiveDate) -> FixedOffset {
        self.offset_from_utc_datetime(&utc.and_hms_opt(12, 0, 0).unwrap())
    }

    fn offset_from_utc_datetime(&self, utc: &NaiveDateTime) -> FixedOffset {
        offset_hours(if is_summer(utc) { 1 } else { 0 })
    }
}

fn local(s: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()
}

fn nine() -> NaiveTime {
    NaiveTime::from_hms_opt(9, 0, 0).unwrap()
}

#[test]
fn test_zone_is_sane() {
    assert_eq!(
        London
            .offset_from_utc_datetime(&utc("2026-07-01T12:00:00Z").naive_utc())
            .fix(),
        offset_hours(1)
    );
    assert_eq!(
        London
            .offset_from_utc_datetime(&utc("2026-12-01T12:00:00Z").naive_utc())
            .fix(),
        offset_hours(0)
    );
}

#[test]
fn local_times_convert_normally_and_across_dst() {
    assert_eq!(
        local_to_utc(&London, local("2026-07-01 09:00")),
        utc("2026-07-01T08:00:00Z")
    );
    assert_eq!(
        local_to_utc(&London, local("2026-12-01 09:00")),
        utc("2026-12-01T09:00:00Z")
    );
    // 01:30 doesn't exist on 29 Mar: the first valid time after the jump is 02:00 BST.
    assert_eq!(
        local_to_utc(&London, local("2026-03-29 01:30")),
        utc("2026-03-29T01:00:00Z")
    );
    // 01:30 happens twice on 25 Oct: the earlier one (BST) wins.
    assert_eq!(
        local_to_utc(&London, local("2026-10-25 01:30")),
        utc("2026-10-25T00:30:00Z")
    );
}

#[test]
fn anchor_for_timed_date_only_and_unscheduled_items() {
    let timed = anchor(&London, Some("2026-07-01T14:00:00.000Z"), None, nine());
    assert_eq!(timed, Some(utc("2026-07-01T14:00:00Z")));
    let day = anchor(&London, None, Some("2026-07-01"), nine());
    assert_eq!(
        day,
        Some(utc("2026-07-01T08:00:00Z")),
        "09:00 local in summer"
    );
    assert_eq!(anchor(&London, None, None, nine()), None);
    assert_eq!(anchor(&London, None, Some("not a date"), nine()), None);
    assert_eq!(anchor(&London, Some("garbage"), None, nine()), None);
}

#[test]
fn offsets_before_the_anchor() {
    let start = utc("2026-07-01T14:00:00Z");
    assert_eq!(fire_time(&London, start, 0), start, "at the time");
    assert_eq!(fire_time(&London, start, 15), utc("2026-07-01T13:45:00Z"));
    assert_eq!(fire_time(&London, start, 60), utc("2026-07-01T13:00:00Z"));
    assert_eq!(fire_time(&London, start, 1440), utc("2026-06-30T14:00:00Z"));
}

#[test]
fn whole_day_offsets_keep_the_local_clock_time_across_dst() {
    // Monday 26 Oct 09:00 GMT, reminded "1 day before": Sunday 25 Oct 09:00 GMT (same clock time),
    // not 24 hours earlier.
    let monday = anchor(&London, None, Some("2026-10-26"), nine()).unwrap();
    assert_eq!(
        fire_time(&London, monday, 1440),
        utc("2026-10-25T09:00:00Z")
    );
    // "1 week before" a date after the spring change lands at 09:00 GMT the week before.
    let april = anchor(&London, None, Some("2026-04-02"), nine()).unwrap();
    assert_eq!(april, utc("2026-04-02T08:00:00Z"));
    assert_eq!(
        fire_time(&London, april, 7 * 1440),
        utc("2026-03-26T09:00:00Z")
    );
    // Minute offsets are exact durations even across the change.
    let early = utc("2026-03-29T02:00:00Z"); // 03:00 BST
    assert_eq!(fire_time(&London, early, 90), utc("2026-03-29T00:30:00Z"));
}

#[test]
fn snoozing() {
    let now = utc("2026-07-01T15:20:00Z");
    assert_eq!(
        snooze_until(&London, now, Snooze::TenMinutes, nine()),
        utc("2026-07-01T15:30:00Z")
    );
    assert_eq!(
        snooze_until(&London, now, Snooze::OneHour, nine()),
        utc("2026-07-01T16:20:00Z")
    );
    assert_eq!(
        snooze_until(&London, now, Snooze::Tomorrow, nine()),
        utc("2026-07-02T08:00:00Z")
    );
    // Late evening in local time is still "today" locally: 23:30 BST on 1 Jul → 2 Jul 09:00.
    let late = utc("2026-07-01T22:30:00Z");
    assert_eq!(
        snooze_until(&London, late, Snooze::Tomorrow, nine()),
        utc("2026-07-02T08:00:00Z")
    );
    // Tomorrow across the autumn change: 09:00 GMT.
    let saturday = utc("2026-10-24T18:00:00Z");
    assert_eq!(
        snooze_until(&London, saturday, Snooze::Tomorrow, nine()),
        utc("2026-10-25T09:00:00Z")
    );
    for choice in [Snooze::TenMinutes, Snooze::OneHour, Snooze::Tomorrow] {
        assert_eq!(Snooze::parse(choice.as_str()), Some(choice));
    }
    assert_eq!(Snooze::parse("forever"), None);
}

#[test]
fn missed_reminders() {
    let due = utc("2026-07-01T09:00:00Z");
    assert!(!is_missed(due, due));
    assert!(
        !is_missed(due, utc("2026-07-01T09:10:00Z")),
        "10 minutes late is still on time"
    );
    assert!(is_missed(due, utc("2026-07-01T09:10:01Z")));
    assert!(
        is_missed(due, utc("2026-07-02T09:00:00Z")),
        "computer was off overnight"
    );
}

#[test]
fn daily_summary_once_per_day_within_its_window() {
    let eight = NaiveTime::from_hms_opt(8, 0, 0).unwrap();
    let today = NaiveDate::from_ymd_opt(2026, 7, 1).unwrap();
    // 08:00 BST = 07:00 UTC.
    assert_eq!(
        summary_due(&London, utc("2026-07-01T06:59:00Z"), eight, None),
        None,
        "too early"
    );
    assert_eq!(
        summary_due(&London, utc("2026-07-01T07:00:00Z"), eight, None),
        Some(today)
    );
    assert_eq!(
        summary_due(&London, utc("2026-07-01T10:30:00Z"), eight, None),
        Some(today),
        "opened late"
    );
    assert_eq!(
        summary_due(&London, utc("2026-07-01T11:00:00Z"), eight, None),
        None,
        "too late today"
    );
    assert_eq!(
        summary_due(&London, utc("2026-07-01T07:05:00Z"), eight, Some(today)),
        None,
        "already sent"
    );
    let yesterday = today.pred_opt().unwrap();
    assert_eq!(
        summary_due(&London, utc("2026-07-01T07:05:00Z"), eight, Some(yesterday)),
        Some(today)
    );
}

#[test]
fn daily_summary_on_dst_days() {
    let one_thirty = NaiveTime::from_hms_opt(1, 30, 0).unwrap();
    let spring = NaiveDate::from_ymd_opt(2026, 3, 29).unwrap();
    // 01:30 doesn't exist that day: the summary goes at 02:00 BST (01:00 UTC).
    assert_eq!(
        summary_due(&London, utc("2026-03-29T00:59:00Z"), one_thirty, None),
        None
    );
    assert_eq!(
        summary_due(&London, utc("2026-03-29T01:00:00Z"), one_thirty, None),
        Some(spring)
    );
}

#[test]
fn parses_day_times() {
    assert_eq!(parse_day_time("09:00"), Some(nine()));
    assert_eq!(parse_day_time("23:59"), NaiveTime::from_hms_opt(23, 59, 0));
    assert_eq!(parse_day_time("24:00"), None);
    assert_eq!(parse_day_time("nine"), None);
}
