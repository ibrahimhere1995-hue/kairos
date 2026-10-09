//! Templates (PRD R15, P3-T04): save a set of items ("Monday kickoff", "Monthly bills") and
//! insert them again relative to a chosen day.

use chrono::{DateTime, Duration, Local, NaiveDate, NaiveTime, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::models::checklist::ChecklistEntryInput;
use crate::models::inputs::ItemInput;
use crate::models::item::{Item, ItemKind, ItemSource};
use crate::repo::templates as repo;
use crate::scheduler::timing::local_to_utc;
use crate::services::{checklist, items};
use crate::util::{new_id, now_utc};

pub const MAX_ITEMS: usize = 100;
const NAME_MAX: usize = 100;

/// One item of a template, with its day relative to the template's first day.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct TemplateEntry {
    pub kind: ItemKind,
    pub title: String,
    pub notes: Option<String>,
    pub area_id: Option<String>,
    pub priority: i32,
    /// Days after the day the template is inserted at (0 = that day).
    pub day_offset: i32,
    /// Local `HH:MM`, or none for an all-day item.
    pub time: Option<String>,
    pub duration_minutes: Option<i64>,
    pub steps: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct Template {
    pub id: String,
    pub name: String,
    pub entries: Vec<TemplateEntry>,
    pub created_at: String,
}

fn date(value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| AppError::invalid("date", "invalidDate"))
}

fn utc(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|t| t.with_timezone(&Utc))
}

/// The entry for one item, its day counted from `first_day`.
fn entry_of(item: &Item, steps: Vec<String>, first_day: NaiveDate) -> Option<TemplateEntry> {
    let start = item
        .start_at
        .as_deref()
        .and_then(utc)
        .map(|s| s.with_timezone(&Local));
    let day = match (&start, &item.due_date) {
        (Some(s), _) => s.date_naive(),
        (None, Some(d)) => date(d).ok()?,
        _ => first_day, // an Inbox task: the template's first day
    };
    let duration = match (
        item.start_at.as_deref().and_then(utc),
        item.end_at.as_deref().and_then(utc),
    ) {
        (Some(s), Some(e)) => Some((e - s).num_minutes()),
        _ => None,
    };
    Some(TemplateEntry {
        kind: item.kind,
        title: item.title.clone(),
        notes: item.notes.clone(),
        area_id: item.area_id.clone(),
        priority: item.priority,
        day_offset: i32::try_from((day - first_day).num_days()).ok()?,
        time: start.map(|s| s.format("%H:%M").to_string()),
        duration_minutes: duration,
        steps,
    })
}

/// Saves these items as a template. Days are kept relative to the earliest one.
pub fn create(conn: &Connection, name: &str, item_ids: &[String]) -> AppResult<Template> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > NAME_MAX {
        return Err(AppError::invalid(
            "name",
            if name.is_empty() {
                "required"
            } else {
                "tooLong"
            },
        ));
    }
    if item_ids.is_empty() || item_ids.len() > MAX_ITEMS {
        return Err(AppError::invalid("items", "outOfRange"));
    }
    let mut details = Vec::new();
    for id in item_ids {
        details.push(checklist::get_detail(conn, id)?);
    }
    let day_of = |item: &Item| {
        item.start_at
            .as_deref()
            .and_then(utc)
            .map(|s| s.with_timezone(&Local).date_naive())
            .or_else(|| item.due_date.as_deref().and_then(|d| date(d).ok()))
    };
    let first_day = details
        .iter()
        .filter_map(|d| day_of(&d.item))
        .min()
        .unwrap_or_else(|| Local::now().date_naive());
    let entries: Vec<TemplateEntry> = details
        .into_iter()
        .filter_map(|d| {
            entry_of(
                &d.item,
                d.checklist.into_iter().map(|s| s.text).collect(),
                first_day,
            )
        })
        .collect();
    let template = Template {
        id: new_id(),
        name: name.to_owned(),
        entries,
        created_at: now_utc(),
    };
    let payload = serde_json::to_string(&template.entries)
        .map_err(|_| AppError::invalid("items", "outOfRange"))?;
    repo::insert(
        conn,
        &template.id,
        &template.name,
        &payload,
        &template.created_at,
    )?;
    Ok(template)
}

pub fn list(conn: &Connection) -> AppResult<Vec<Template>> {
    Ok(repo::list(conn)?
        .into_iter()
        .map(|(id, name, payload, created_at)| Template {
            id,
            name,
            entries: serde_json::from_str(&payload).unwrap_or_default(),
            created_at,
        })
        .collect())
}

pub fn set_deleted(conn: &Connection, id: &str, deleted: bool) -> AppResult<()> {
    let now = now_utc();
    if repo::set_deleted(conn, id, deleted.then_some(now.as_str()), &now)? == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Inserts a template's items with its first day on `start_date` (local). Returns the new items
/// (the UI offers Undo, which moves them to the Trash).
pub fn apply(conn: &mut Connection, id: &str, start_date: &str) -> AppResult<Vec<Item>> {
    let payload = repo::get_payload(conn, id)?.ok_or(AppError::NotFound)?;
    let entries: Vec<TemplateEntry> =
        serde_json::from_str(&payload).map_err(|_| AppError::NotFound)?;
    let start = date(start_date)?;
    let mut created = Vec::new();
    for e in entries {
        let day = start + Duration::days(i64::from(e.day_offset));
        let time = e
            .time
            .as_deref()
            .and_then(|t| NaiveTime::parse_from_str(t, "%H:%M").ok());
        let (start_at, end_at, due_date) = match time {
            Some(t) => {
                let s = local_to_utc(&Local, day.and_time(t));
                let iso = |x: DateTime<Utc>| x.to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
                (
                    Some(iso(s)),
                    e.duration_minutes
                        .filter(|m| *m > 0)
                        .map(|m| iso(s + Duration::minutes(m))),
                    None,
                )
            }
            None => (None, None, Some(day.format("%Y-%m-%d").to_string())),
        };
        let item = items::create(
            conn,
            &ItemInput {
                kind: e.kind,
                title: e.title,
                notes: e.notes,
                area_id: e.area_id,
                priority: e.priority,
                start_at,
                end_at,
                due_date,
                location: None,
                source: Some(ItemSource::Template),
                reminders: None,
                rrule: None,
                milestone_id: None,
            },
        )?;
        if !e.steps.is_empty() {
            let steps: Vec<ChecklistEntryInput> = e
                .steps
                .into_iter()
                .map(|text| ChecklistEntryInput {
                    id: None,
                    text,
                    done: false,
                })
                .collect();
            checklist::set_checklist(conn, &item.id, &steps)?;
        }
        created.push(item);
    }
    Ok(created)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;

    fn add(
        c: &mut Connection,
        title: &str,
        start: Option<&str>,
        end: Option<&str>,
        due: Option<&str>,
    ) -> String {
        items::create(
            c,
            &ItemInput {
                kind: if end.is_some() {
                    ItemKind::Event
                } else {
                    ItemKind::Task
                },
                title: title.into(),
                notes: None,
                area_id: None,
                priority: 2,
                start_at: start.map(Into::into),
                end_at: end.map(Into::into),
                due_date: due.map(Into::into),
                location: None,
                source: None,
                reminders: Some(vec![]),
                rrule: None,
                milestone_id: None,
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn saves_relative_days_and_inserts_them_elsewhere() {
        let mut c = migrated_conn();
        // A Monday plan: an all-day task that day, a timed meeting the next day.
        let local = |d: &str, t: &str| {
            local_to_utc(
                &Local,
                date(d)
                    .unwrap()
                    .and_time(NaiveTime::parse_from_str(t, "%H:%M").unwrap()),
            )
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
        };
        let a = add(&mut c, "Plan the week", None, None, Some("2030-01-07"));
        let b = add(
            &mut c,
            "Team sync",
            Some(&local("2030-01-08", "10:00")),
            Some(&local("2030-01-08", "10:30")),
            None,
        );
        checklist::set_checklist(
            &mut c,
            &a,
            &[ChecklistEntryInput {
                id: None,
                text: "Check inbox".into(),
                done: false,
            }],
        )
        .unwrap();

        let t = create(&c, " Monday kickoff ", &[a, b]).unwrap();
        assert_eq!(t.name, "Monday kickoff");
        assert_eq!(
            t.entries.iter().map(|e| e.day_offset).collect::<Vec<_>>(),
            [0, 1]
        );
        assert_eq!(t.entries[1].time.as_deref(), Some("10:00"));
        assert_eq!(t.entries[1].duration_minutes, Some(30));
        assert_eq!(t.entries[0].steps, ["Check inbox"]);

        let made = apply(&mut c, &t.id, "2030-02-04").unwrap();
        assert_eq!(made[0].due_date.as_deref(), Some("2030-02-04"));
        assert_eq!(made[1].start_at, Some(local("2030-02-05", "10:00")));
        assert_eq!(made[1].end_at, Some(local("2030-02-05", "10:30")));
        assert_eq!(made[0].source, ItemSource::Template);
        assert_eq!(
            checklist::get_detail(&c, &made[0].id)
                .unwrap()
                .checklist
                .len(),
            1
        );
        assert_eq!(list(&c).unwrap().len(), 1);
    }

    #[test]
    fn validation_and_delete_with_undo() {
        let mut c = migrated_conn();
        let a = add(&mut c, "X", None, None, Some("2030-01-07"));
        assert!(create(&c, "  ", std::slice::from_ref(&a)).is_err());
        assert!(create(&c, "Empty", &[]).is_err());
        assert!(create(&c, "Ghost", &["missing".into()]).is_err());
        let t = create(&c, "One", &[a]).unwrap();
        set_deleted(&c, &t.id, true).unwrap();
        assert!(list(&c).unwrap().is_empty());
        assert!(apply(&mut c, &t.id, "2030-01-01").is_err());
        set_deleted(&c, &t.id, false).unwrap();
        assert_eq!(list(&c).unwrap().len(), 1);
    }
}
