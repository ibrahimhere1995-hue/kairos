//! iCalendar (`.ics`, RFC 5545) for P2-T12: writing Kairos items out, reading other
//! calendars in. Pure text in / text out; the database side is in `portability`.

use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, TimeZone, Utc};
use icalendar::parser::{Component, read_calendar, unfold};

use crate::models::item::{Item, ItemKind};
use crate::scheduler::recurrence::{self as rule, parse_key};
use crate::scheduler::timing::local_to_utc;

/// Imports stop here, so a huge file can't stall the app.
pub const MAX_COMPONENTS: usize = 5000;
const LINE_OCTETS: usize = 75;

// ---------- writing ----------

/// TEXT escaping (RFC 5545 §3.3.11).
fn escape_text(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace(';', "\\;")
        .replace(',', "\\,")
        .replace("\r\n", "\\n")
        .replace('\n', "\\n")
}

/// Content lines longer than 75 octets are folded (continuation lines start with a space),
/// never splitting a UTF-8 character.
fn fold(line: &str) -> String {
    let mut out = String::with_capacity(line.len() + 8);
    let mut width = 0;
    for ch in line.chars() {
        let len = ch.len_utf8();
        if width + len > LINE_OCTETS {
            out.push_str("\r\n ");
            width = 1;
        }
        out.push(ch);
        width += len;
    }
    out.push_str("\r\n");
    out
}

fn utc_stamp(t: DateTime<Utc>) -> String {
    t.format("%Y%m%dT%H%M%SZ").to_string()
}

fn parse_utc(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|t| t.with_timezone(&Utc))
}

fn date_value(date: NaiveDate) -> String {
    date.format("%Y%m%d").to_string()
}

/// One VEVENT (events) or VTODO (tasks). A series is written with floating local times
/// (Kairos repeats in local wall-clock time) plus EXDATEs for its stored occurrences.
fn write_item<Tz: TimeZone>(
    tz: &Tz,
    item: &Item,
    exdates: &[String],
    now: DateTime<Utc>,
) -> String {
    let component = if item.kind == ItemKind::Event {
        "VEVENT"
    } else {
        "VTODO"
    };
    let mut lines = vec![
        format!("BEGIN:{component}"),
        format!("UID:{}@kairos", item.id),
        format!("DTSTAMP:{}", utc_stamp(now)),
        format!("SUMMARY:{}", escape_text(&item.title)),
    ];
    if let Some(notes) = item.notes.as_deref().filter(|n| !n.is_empty()) {
        lines.push(format!("DESCRIPTION:{}", escape_text(notes)));
    }
    if let Some(location) = item.location.as_deref().filter(|l| !l.is_empty()) {
        lines.push(format!("LOCATION:{}", escape_text(location)));
    }
    let series = item.rrule.is_some() && item.recurrence_parent_id.is_none();
    let end_name = if item.kind == ItemKind::Event {
        "DTEND"
    } else {
        "DUE"
    };

    if let Some(date) = item
        .due_date
        .as_deref()
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
    {
        lines.push(format!("DTSTART;VALUE=DATE:{}", date_value(date)));
        if item.kind == ItemKind::Event {
            let next = date.succ_opt().unwrap_or(date);
            lines.push(format!("DTEND;VALUE=DATE:{}", date_value(next)));
        }
    } else if let Some(start) = item.start_at.as_deref().and_then(parse_utc) {
        let end = item.end_at.as_deref().and_then(parse_utc);
        if series {
            let local = |t: DateTime<Utc>| {
                t.with_timezone(tz)
                    .naive_local()
                    .format("%Y%m%dT%H%M%S")
                    .to_string()
            };
            lines.push(format!("DTSTART:{}", local(start)));
            if let Some(end) = end {
                lines.push(format!("{end_name}:{}", local(end)));
            }
        } else {
            lines.push(format!("DTSTART:{}", utc_stamp(start)));
            if let Some(end) = end {
                lines.push(format!("{end_name}:{}", utc_stamp(end)));
            }
        }
    }
    if let (true, Some(rrule)) = (series, item.rrule.as_deref()) {
        // Kairos writes UNTIL in local wall-clock time; with floating DTSTART it must be floating.
        lines.push(format!(
            "RRULE:{}",
            rrule.replace("Z;", ";").trim_end_matches('Z')
        ));
        for key in exdates {
            if let Some(at) = parse_key(key) {
                let value = if rule::is_date_only(item) {
                    format!(";VALUE=DATE:{}", date_value(at.date()))
                } else {
                    format!(":{}", at.format("%Y%m%dT%H%M%S"))
                };
                lines.push(format!("EXDATE{value}"));
            }
        }
    }
    if let Some(done) = item.completed_at.as_deref().and_then(parse_utc) {
        lines.push("STATUS:COMPLETED".into());
        lines.push(format!("COMPLETED:{}", utc_stamp(done)));
    }
    lines.push(format!("END:{component}"));
    lines.iter().map(|l| fold(l)).collect()
}

/// A whole calendar. `exdates` gives each series' stored occurrence keys (those are written
/// as their own items, so the series must skip them).
pub fn write_calendar<Tz: TimeZone>(
    tz: &Tz,
    items: &[(Item, Vec<String>)],
    now: DateTime<Utc>,
) -> String {
    let mut out = String::new();
    for line in [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Kairos//Kairos planner//EN",
        "CALSCALE:GREGORIAN",
    ] {
        out.push_str(&fold(line));
    }
    for (item, exdates) in items {
        out.push_str(&write_item(tz, item, exdates, now));
    }
    out.push_str(&fold("END:VCALENDAR"));
    out
}

// ---------- reading ----------

/// One calendar entry, ready to become a Kairos item.
#[derive(Debug, Clone, PartialEq)]
pub struct Imported {
    pub kind: ItemKind,
    pub title: String,
    pub notes: Option<String>,
    pub location: Option<String>,
    /// UTC instants (timed) …
    pub start_at: Option<String>,
    pub end_at: Option<String>,
    /// … or a local date (all day).
    pub due_date: Option<String>,
    pub rrule: Option<String>,
    pub completed: bool,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ReadResult {
    pub entries: Vec<Imported>,
    /// Entries Kairos can't represent (cancelled, changed single occurrences, no date for an
    /// event…).
    pub skipped: usize,
    /// Imported without their repeat, because the repeat rule isn't one Kairos supports.
    pub simplified: usize,
}

fn prop<'a>(c: &'a Component<'_>, name: &str) -> Option<&'a icalendar::parser::Property<'a>> {
    c.find_prop(name)
}

fn text(c: &Component<'_>, name: &str) -> Option<String> {
    prop(c, name)
        .map(|p| p.val.as_str().trim().to_owned())
        .filter(|v| !v.is_empty())
}

fn param<'a>(p: &'a icalendar::parser::Property<'_>, key: &str) -> Option<&'a str> {
    p.params
        .iter()
        .find(|param| param.key.as_str().eq_ignore_ascii_case(key))
        .and_then(|param| param.val.as_ref())
        .map(|v| v.as_str())
}

/// A DATE or DATE-TIME property: either a local date, or a UTC instant.
enum When {
    Date(NaiveDate),
    Instant(DateTime<Utc>),
}

fn when<Tz: TimeZone>(local: &Tz, c: &Component<'_>, name: &str) -> Option<When> {
    let p = prop(c, name)?;
    let value = p.val.as_str().trim();
    if param(p, "VALUE").is_some_and(|v| v.eq_ignore_ascii_case("DATE")) || value.len() == 8 {
        return NaiveDate::parse_from_str(value, "%Y%m%d")
            .ok()
            .map(When::Date);
    }
    if let Some(utc) = value.strip_suffix('Z') {
        let naive = NaiveDateTime::parse_from_str(utc, "%Y%m%dT%H%M%S").ok()?;
        return Some(When::Instant(Utc.from_utc_datetime(&naive)));
    }
    let naive = NaiveDateTime::parse_from_str(value, "%Y%m%dT%H%M%S").ok()?;
    // A named zone (e.g. Europe/London); unknown names (some apps use Windows names) and
    // floating times are read as this computer's local time.
    let zone = param(p, "TZID").and_then(|id| id.trim_matches('"').parse::<chrono_tz::Tz>().ok());
    Some(When::Instant(match zone {
        Some(zone) => local_to_utc(&zone, naive),
        None => local_to_utc(local, naive),
    }))
}

/// ISO 8601 durations as used in iCalendar: P1W, P2D, PT1H30M, P1DT2H…
fn duration(value: &str) -> Option<Duration> {
    let rest = value
        .trim()
        .strip_prefix('P')
        .or_else(|| value.trim().strip_prefix("+P"))?;
    let (mut total, mut number, mut in_time) = (Duration::zero(), String::new(), false);
    for ch in rest.chars() {
        match ch {
            '0'..='9' => number.push(ch),
            'T' => in_time = true,
            unit => {
                let n: i64 = number.parse().ok()?;
                number.clear();
                total += match (unit, in_time) {
                    ('W', false) => Duration::weeks(n),
                    ('D', false) => Duration::days(n),
                    ('H', true) => Duration::hours(n),
                    ('M', true) => Duration::minutes(n),
                    ('S', true) => Duration::seconds(n),
                    _ => return None,
                };
            }
        }
    }
    Some(total)
}

fn iso(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn read_entry<Tz: TimeZone>(local: &Tz, c: &Component<'_>, result: &mut ReadResult) {
    let kind = if c.name.as_str().eq_ignore_ascii_case("VEVENT") {
        ItemKind::Event
    } else {
        ItemKind::Task
    };
    let cancelled = text(c, "STATUS").is_some_and(|s| s.eq_ignore_ascii_case("CANCELLED"));
    // A changed single occurrence of a series: Kairos keeps the series itself.
    if cancelled || prop(c, "RECURRENCE-ID").is_some() {
        result.skipped += 1;
        return;
    }
    let title = text(c, "SUMMARY").unwrap_or_else(|| crate::i18n::t("portability.untitled", &[]));
    let mut entry = Imported {
        kind,
        title: title.chars().take(500).collect(),
        notes: text(c, "DESCRIPTION"),
        location: text(c, "LOCATION"),
        start_at: None,
        end_at: None,
        due_date: None,
        rrule: None,
        completed: text(c, "STATUS").is_some_and(|s| s.eq_ignore_ascii_case("COMPLETED"))
            || prop(c, "COMPLETED").is_some(),
    };
    let start = when(local, c, "DTSTART").or_else(|| when(local, c, "DUE"));
    match start {
        Some(When::Date(date)) => entry.due_date = Some(date.format("%Y-%m-%d").to_string()),
        Some(When::Instant(start)) => {
            let end = match when(
                local,
                c,
                if kind == ItemKind::Event {
                    "DTEND"
                } else {
                    "DUE"
                },
            ) {
                Some(When::Instant(end)) if end > start => Some(end),
                _ => prop(c, "DURATION")
                    .and_then(|p| duration(p.val.as_str()))
                    .filter(|d| *d > Duration::zero())
                    .map(|d| start + d),
            };
            // Kairos events always have an end: an hour unless the file says otherwise.
            let end = end.or((kind == ItemKind::Event).then(|| start + Duration::hours(1)));
            entry.start_at = Some(iso(start));
            entry.end_at = end.map(iso);
        }
        None if kind == ItemKind::Event => {
            result.skipped += 1;
            return;
        }
        None => {}
    }
    if let Some(rrule) = text(c, "RRULE") {
        match rule::normalize_rule(&rrule) {
            Ok(rule) if entry.start_at.is_some() || entry.due_date.is_some() => {
                entry.rrule = Some(rule)
            }
            _ => result.simplified += 1,
        }
    }
    result.entries.push(entry);
}

/// The text isn't an iCalendar file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NotACalendar;

/// Reads VEVENTs (as events) and VTODOs (as tasks). Errors only when the text isn't an
/// iCalendar file at all.
pub fn read<Tz: TimeZone>(local: &Tz, content: &str) -> Result<ReadResult, NotACalendar> {
    let unfolded = unfold(content);
    let calendar = read_calendar(&unfolded).map_err(|_| NotACalendar)?;
    let mut result = ReadResult::default();
    let entries = calendar.components.iter().filter(|c| {
        let name = c.name.as_str();
        name.eq_ignore_ascii_case("VEVENT") || name.eq_ignore_ascii_case("VTODO")
    });
    for (seen, component) in entries.enumerate() {
        if seen == MAX_COMPONENTS {
            result.skipped += 1;
            continue;
        }
        read_entry(local, component, &mut result);
    }
    Ok(result)
}

#[cfg(test)]
#[path = "ics_tests.rs"]
mod tests;
