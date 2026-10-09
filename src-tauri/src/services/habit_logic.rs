//! Habit streaks (PRD R13): pure date maths, tested without a database.
//! A missed day never shames: the streak is simply "paused" until the next tick.

use std::collections::BTreeSet;

use chrono::{Datelike, Duration, NaiveDate, Weekday};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Frequency {
    Daily,
    /// N times per week (1–7).
    Weekly(u8),
}

impl Frequency {
    pub fn parse(value: &str) -> Option<Self> {
        if value == "daily" {
            return Some(Self::Daily);
        }
        let n: u8 = value.strip_prefix("weekly:")?.parse().ok()?;
        (1..=7).contains(&n).then_some(Self::Weekly(n))
    }

    pub fn as_string(self) -> String {
        match self {
            Self::Daily => "daily".into(),
            Self::Weekly(n) => format!("weekly:{n}"),
        }
    }
}

/// First day of the week containing `day`.
pub fn week_start(day: NaiveDate, starts_on: Weekday) -> NaiveDate {
    let back = (7 + day.weekday().num_days_from_monday() - starts_on.num_days_from_monday()) % 7;
    day - Duration::days(i64::from(back))
}

/// Current streak: consecutive days (daily) or weeks that met the target (weekly), ending today.
/// Today (or this week) still in progress doesn't break the streak.
pub fn streak(
    freq: Frequency,
    done: &BTreeSet<NaiveDate>,
    today: NaiveDate,
    starts_on: Weekday,
) -> u32 {
    match freq {
        Frequency::Daily => {
            let mut day = if done.contains(&today) {
                today
            } else {
                today - Duration::days(1)
            };
            let mut count = 0;
            while done.contains(&day) {
                count += 1;
                day -= Duration::days(1);
            }
            count
        }
        Frequency::Weekly(target) => {
            let this_week = week_start(today, starts_on);
            let met = |start: NaiveDate| {
                let n = done.range(start..start + Duration::days(7)).count();
                n >= usize::from(target)
            };
            let mut start = if met(this_week) {
                this_week
            } else {
                this_week - Duration::days(7)
            };
            let mut count = 0;
            while met(start) {
                count += 1;
                start -= Duration::days(7);
            }
            count
        }
    }
}

/// How many ticks in the week containing `today`.
pub fn this_week(done: &BTreeSet<NaiveDate>, today: NaiveDate, starts_on: Weekday) -> u32 {
    let start = week_start(today, starts_on);
    u32::try_from(done.range(start..start + Duration::days(7)).count()).unwrap_or(u32::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn set(days: &[&str]) -> BTreeSet<NaiveDate> {
        days.iter().map(|s| d(s)).collect()
    }

    #[test]
    fn frequencies_round_trip() {
        assert_eq!(Frequency::parse("daily"), Some(Frequency::Daily));
        assert_eq!(Frequency::parse("weekly:3"), Some(Frequency::Weekly(3)));
        assert_eq!(Frequency::parse("weekly:0"), None);
        assert_eq!(Frequency::parse("weekly:8"), None);
        assert_eq!(Frequency::parse("hourly"), None);
        assert_eq!(Frequency::Weekly(4).as_string(), "weekly:4");
    }

    #[test]
    fn week_starts() {
        // 2026-10-08 is a Thursday.
        assert_eq!(week_start(d("2026-10-08"), Weekday::Mon), d("2026-10-05"));
        assert_eq!(week_start(d("2026-10-08"), Weekday::Sun), d("2026-10-04"));
        assert_eq!(week_start(d("2026-10-05"), Weekday::Mon), d("2026-10-05"));
    }

    #[test]
    fn daily_streaks() {
        let today = d("2026-10-08");
        let ticks = set(&["2026-10-06", "2026-10-07", "2026-10-08"]);
        assert_eq!(streak(Frequency::Daily, &ticks, today, Weekday::Mon), 3);
        // Not ticked yet today: yesterday's run still counts.
        let ticks = set(&["2026-10-06", "2026-10-07"]);
        assert_eq!(streak(Frequency::Daily, &ticks, today, Weekday::Mon), 2);
        // A missed day pauses it.
        let ticks = set(&["2026-10-05", "2026-10-06"]);
        assert_eq!(streak(Frequency::Daily, &ticks, today, Weekday::Mon), 0);
        assert_eq!(
            streak(Frequency::Daily, &BTreeSet::new(), today, Weekday::Mon),
            0
        );
        // Across a month end.
        let ticks = set(&["2026-09-30", "2026-10-01"]);
        assert_eq!(
            streak(Frequency::Daily, &ticks, d("2026-10-01"), Weekday::Mon),
            2
        );
    }

    #[test]
    fn weekly_streaks() {
        let today = d("2026-10-08"); // week of Mon 5 Oct
        // Last two weeks met 2×; this week only 1 so far (in progress, doesn't break it).
        let ticks = set(&[
            "2026-09-21",
            "2026-09-23",
            "2026-09-28",
            "2026-10-01",
            "2026-10-06",
        ]);
        assert_eq!(streak(Frequency::Weekly(2), &ticks, today, Weekday::Mon), 2);
        // This week met too → 3.
        let more = set(&[
            "2026-09-21",
            "2026-09-23",
            "2026-09-28",
            "2026-10-01",
            "2026-10-06",
            "2026-10-07",
        ]);
        assert_eq!(streak(Frequency::Weekly(2), &more, today, Weekday::Mon), 3);
        assert_eq!(this_week(&more, today, Weekday::Mon), 2);
        // Week start matters: with Sunday starts, Sun 4 Oct belongs to this week.
        let sunday = set(&["2026-10-04", "2026-10-06"]);
        assert_eq!(this_week(&sunday, today, Weekday::Sun), 2);
        assert_eq!(this_week(&sunday, today, Weekday::Mon), 1);
    }
}
