//! Pure reminder time maths (PRD R3, ARCHITECTURE §6.2). No database, no clock:
//! every function takes the time zone and "now", so it is tested across DST changes.

use chrono::{DateTime, Duration, LocalResult, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};

const MINUTES_PER_DAY: i64 = 24 * 60;

/// Reminders that should have fired more than this long ago (the computer was asleep or off)
/// are "missed": several of them are combined into one "While you were away" notification.
pub const MISSED_AFTER: Duration = Duration::minutes(10);

/// The daily summary is still worth sending this long after its time (e.g. the laptop was
/// opened at 10:30 for an 08:00 summary); later than that, today's is skipped.
pub const SUMMARY_WINDOW: Duration = Duration::hours(4);

/// A local wall-clock time as a UTC instant.
/// In a spring-forward gap the first valid local time after it is used (02:30 → 03:00);
/// in a fall-back overlap the earlier of the two instants.
pub fn local_to_utc<Tz: TimeZone>(tz: &Tz, local: NaiveDateTime) -> DateTime<Utc> {
    match tz.from_local_datetime(&local) {
        LocalResult::Single(t) => t.with_timezone(&Utc),
        LocalResult::Ambiguous(earliest, _) => earliest.with_timezone(&Utc),
        LocalResult::None => (1..=180)
            .find_map(|m| {
                tz.from_local_datetime(&(local + Duration::minutes(m)))
                    .earliest()
            })
            .map_or_else(|| Utc.from_utc_datetime(&local), |t| t.with_timezone(&Utc)),
    }
}

/// When the item "happens": the start of a timed item, or `day_time` on a date-only item's day.
/// `None` for unscheduled items or unreadable values.
pub fn anchor<Tz: TimeZone>(
    tz: &Tz,
    start_at: Option<&str>,
    due_date: Option<&str>,
    day_time: NaiveTime,
) -> Option<DateTime<Utc>> {
    if let Some(start) = start_at {
        return DateTime::parse_from_rfc3339(start)
            .ok()
            .map(|t| t.with_timezone(&Utc));
    }
    let date = NaiveDate::parse_from_str(due_date?, "%Y-%m-%d").ok()?;
    Some(local_to_utc(tz, date.and_time(day_time)))
}

/// The moment a reminder `offset_minutes` before `anchor` fires.
/// Whole days ("1 day before") keep the local clock time across a DST change;
/// anything else ("15 min before") is an exact duration.
pub fn fire_time<Tz: TimeZone>(
    tz: &Tz,
    anchor: DateTime<Utc>,
    offset_minutes: i64,
) -> DateTime<Utc> {
    if offset_minutes > 0 && offset_minutes % MINUTES_PER_DAY == 0 {
        let local = anchor.with_timezone(tz).naive_local();
        local_to_utc(tz, local - Duration::days(offset_minutes / MINUTES_PER_DAY))
    } else {
        anchor - Duration::minutes(offset_minutes)
    }
}

/// Snooze choices on a reminder notification (PRD R3).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Snooze {
    TenMinutes,
    OneHour,
    /// Tomorrow at the default reminder time.
    Tomorrow,
}

impl Snooze {
    pub fn as_str(self) -> &'static str {
        match self {
            Snooze::TenMinutes => "10m",
            Snooze::OneHour => "1h",
            Snooze::Tomorrow => "tomorrow",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "10m" => Some(Snooze::TenMinutes),
            "1h" => Some(Snooze::OneHour),
            "tomorrow" => Some(Snooze::Tomorrow),
            _ => None,
        }
    }
}

pub fn snooze_until<Tz: TimeZone>(
    tz: &Tz,
    now: DateTime<Utc>,
    choice: Snooze,
    day_time: NaiveTime,
) -> DateTime<Utc> {
    match choice {
        Snooze::TenMinutes => now + Duration::minutes(10),
        Snooze::OneHour => now + Duration::hours(1),
        Snooze::Tomorrow => {
            let today = now.with_timezone(tz).date_naive();
            let tomorrow = today.succ_opt().unwrap_or(today);
            local_to_utc(tz, tomorrow.and_time(day_time))
        }
    }
}

/// Whether a reminder that was due at `fire_at` is only being noticed now, long after.
pub fn is_missed(fire_at: DateTime<Utc>, now: DateTime<Utc>) -> bool {
    now - fire_at > MISSED_AFTER
}

/// The local date whose daily summary should be sent now, if any:
/// once per day, from `at` until `SUMMARY_WINDOW` later.
pub fn summary_due<Tz: TimeZone>(
    tz: &Tz,
    now: DateTime<Utc>,
    at: NaiveTime,
    last_sent: Option<NaiveDate>,
) -> Option<NaiveDate> {
    let today = now.with_timezone(tz).date_naive();
    if last_sent == Some(today) {
        return None;
    }
    let due = local_to_utc(tz, today.and_time(at));
    (now >= due && now - due < SUMMARY_WINDOW).then_some(today)
}

/// `HH:mm` → time of day.
pub fn parse_day_time(value: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(value, "%H:%M").ok()
}

#[cfg(test)]
#[path = "timing_tests.rs"]
mod tests;
