//! A3 — "Plan my day / week" (PRD §7.3). The AI proposes slots for open tasks around what is
//! already planned; Kairos keeps only proposals that really fit, and the user accepts all,
//! some or none. Only task titles and lengths and the busy times' titles are sent.

use std::collections::{HashMap, HashSet};

use chrono::{NaiveDate, NaiveDateTime, NaiveTime, Timelike};
use serde_json::{Value, json};

use crate::ai::parse::{local_now, string, within};
use crate::ai::{AiProvider, Part};
use crate::error::{AppError, AppResult};
use crate::models::ai::{PlanProposal, PlanRequest};

const INSTRUCTION_MAX: usize = 500;
const DAYS_MAX: usize = 7;
const TASKS_MAX: usize = 30;
const BUSY_MAX: usize = 40;
const TITLE_MAX: usize = 200;
const DEFAULT_MINUTES: i64 = 30;
const SLOT_MIN: i64 = 5;
const SLOT_MAX: i64 = 8 * 60;

/// Minutes since midnight.
fn minutes(time: NaiveTime) -> i64 {
    i64::from(time.hour() * 60 + time.minute())
}

fn clock(value: &str) -> Option<i64> {
    NaiveTime::parse_from_str(value, "%H:%M").ok().map(minutes)
}

/// The request, checked: days with their busy minutes, tasks with their lengths.
struct Checked {
    now: NaiveDateTime,
    day_start: i64,
    day_end: i64,
    busy: HashMap<NaiveDate, Vec<(i64, i64)>>,
    tasks: HashMap<String, Option<i64>>,
}

fn check(req: &PlanRequest) -> AppResult<Checked> {
    if req.instruction.chars().count() > INSTRUCTION_MAX {
        return Err(AppError::invalid("instruction", "tooLong"));
    }
    if req.tasks.is_empty() {
        return Err(AppError::Ai("nothingToPlan"));
    }
    if req.days.is_empty()
        || req.days.len() > DAYS_MAX
        || req.tasks.len() > TASKS_MAX
        || req.days.iter().any(|d| d.busy.len() > BUSY_MAX)
    {
        return Err(AppError::invalid("plan", "outOfRange"));
    }
    let (Some(day_start), Some(day_end)) = (clock(&req.day_start), clock(&req.day_end)) else {
        return Err(AppError::invalid("plan", "invalidDateTime"));
    };
    if day_start >= day_end {
        return Err(AppError::invalid("plan", "outOfRange"));
    }
    let mut busy = HashMap::new();
    for day in &req.days {
        let date = NaiveDate::parse_from_str(&day.date, "%Y-%m-%d")
            .map_err(|_| AppError::invalid("plan", "invalidDate"))?;
        let blocks = day
            .busy
            .iter()
            .filter_map(|b| Some((clock(&b.start)?, clock(&b.end)?)))
            .collect();
        busy.insert(date, blocks);
    }
    Ok(Checked {
        now: local_now(&req.now)?,
        day_start,
        day_end,
        busy,
        tasks: req
            .tasks
            .iter()
            .map(|t| (t.id.clone(), t.duration_minutes))
            .collect(),
    })
}

fn schema() -> Value {
    json!({
        "type": "OBJECT",
        "properties": {
            "proposals": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "taskId": { "type": "STRING" },
                        "date": { "type": "STRING" },
                        "start": { "type": "STRING" },
                        "durationMinutes": { "type": "INTEGER" },
                    },
                    "required": ["taskId", "date", "start", "durationMinutes"],
                },
            },
        },
        "required": ["proposals"],
    })
}

fn short(title: &str) -> String {
    title.chars().take(TITLE_MAX).collect()
}

fn prompt(req: &PlanRequest, now: NaiveDateTime) -> String {
    let days: Vec<Value> = req
        .days
        .iter()
        .map(|d| {
            let weekday = NaiveDate::parse_from_str(&d.date, "%Y-%m-%d")
                .map(|date| date.format("%A").to_string())
                .unwrap_or_default();
            let busy: Vec<Value> = d
                .busy
                .iter()
                .map(|b| json!({ "title": short(&b.title), "start": b.start, "end": b.end }))
                .collect();
            json!({ "date": d.date, "weekday": weekday, "busy": busy })
        })
        .collect();
    let tasks: Vec<Value> = req
        .tasks
        .iter()
        .map(|t| json!({ "id": t.id, "title": short(&t.title), "durationMinutes": t.duration_minutes }))
        .collect();
    let context = json!({
        "now": now.format("%A %Y-%m-%d %H:%M").to_string(),
        "workingHours": { "start": req.day_start, "end": req.day_end },
        "days": days,
        "tasks": tasks,
        "request": req.instruction.trim(),
        "bestHours": req.preferred_hours.as_deref().map(short),
    });
    format!(
        "You are a calm planning assistant. Propose times for the open tasks on the given \
         days, following the user's request if there is one.\n\
         Rules: only use the listed task ids and days; stay inside working hours; never overlap \
         busy times or each other; nothing earlier than now; use a task's durationMinutes when \
         given, otherwise a sensible length (15–120 minutes); leave short breaks; put the most demanding tasks in \
         bestHours when given; it is fine to leave tasks out if the days are full.\n\
         Return JSON {{\"proposals\": [{{taskId, date (YYYY-MM-DD), start (HH:MM, 24-hour), \
         durationMinutes}}]}}.\n\
         Context: {context}"
    )
}

/// Keeps only proposals that fit: a known task (once), a listed day, inside working hours,
/// not in the past, and not overlapping busy times or each other. Sorted by time.
fn keep_fitting(value: &Value, req: &Checked) -> Vec<PlanProposal> {
    let mut used = HashSet::new();
    let mut taken: HashMap<NaiveDate, Vec<(i64, i64)>> = HashMap::new();
    let mut out = Vec::new();
    let entries = value
        .get("proposals")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for entry in &entries {
        let Some(task_id) = string(entry, "taskId") else {
            continue;
        };
        let Some(own) = req.tasks.get(&task_id) else {
            continue;
        };
        let Some(date) =
            string(entry, "date").and_then(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok())
        else {
            continue;
        };
        let (Some(busy), Some(start)) = (
            req.busy.get(&date),
            string(entry, "start").and_then(|s| clock(&s)),
        ) else {
            continue;
        };
        let length = within(entry, "durationMinutes", SLOT_MAX)
            .filter(|m| *m >= SLOT_MIN)
            .or(*own)
            .unwrap_or(DEFAULT_MINUTES);
        let end = start + length;
        let overlaps = |blocks: &[(i64, i64)]| blocks.iter().any(|(s, e)| start < *e && *s < end);
        let past =
            date < req.now.date() || (date == req.now.date() && start < minutes(req.now.time()));
        let day_taken = taken.entry(date).or_default();
        if used.contains(&task_id)
            || start < req.day_start
            || end > req.day_end
            || past
            || overlaps(busy)
            || overlaps(day_taken)
        {
            continue;
        }
        day_taken.push((start, end));
        used.insert(task_id.clone());
        out.push(PlanProposal {
            task_id,
            date: date.format("%Y-%m-%d").to_string(),
            start: format!("{:02}:{:02}", start / 60, start % 60),
            duration_minutes: length,
        });
    }
    out.sort_by(|a, b| (&a.date, &a.start).cmp(&(&b.date, &b.start)));
    out
}

pub async fn plan(provider: &impl AiProvider, req: &PlanRequest) -> AppResult<Vec<PlanProposal>> {
    let checked = check(req)?;
    let answer = provider
        .generate_json(&[Part::Text(prompt(req, checked.now))], &schema())
        .await?;
    Ok(keep_fitting(&answer, &checked))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ai::{PlanBusy, PlanDay, PlanTask};

    fn request() -> PlanRequest {
        PlanRequest {
            instruction: "around my Thursday meeting".into(),
            now: "2026-10-12T10:00".into(),
            day_start: "09:00".into(),
            day_end: "18:00".into(),
            days: vec![
                PlanDay {
                    date: "2026-10-12".into(),
                    busy: vec![PlanBusy {
                        title: "Team sync".into(),
                        start: "11:00".into(),
                        end: "12:00".into(),
                    }],
                },
                PlanDay {
                    date: "2026-10-13".into(),
                    busy: vec![],
                },
            ],
            tasks: vec![
                PlanTask {
                    id: "a".into(),
                    title: "Write report".into(),
                    duration_minutes: Some(60),
                },
                PlanTask {
                    id: "b".into(),
                    title: "Call bank".into(),
                    duration_minutes: None,
                },
                PlanTask {
                    id: "c".into(),
                    title: "Gym".into(),
                    duration_minutes: None,
                },
            ],
            preferred_hours: Some("09:00–11:00".into()),
        }
    }

    fn proposal(task: &str, date: &str, start: &str, minutes: i64) -> Value {
        json!({ "taskId": task, "date": date, "start": start, "durationMinutes": minutes })
    }

    struct Fake(Value);

    impl AiProvider for Fake {
        async fn generate_json(&self, parts: &[Part], _schema: &Value) -> AppResult<Value> {
            let [Part::Text(prompt)] = parts else {
                panic!("text only")
            };
            assert!(prompt.contains("Team sync") && prompt.contains("Write report"));
            assert!(prompt.contains("Monday 2026-10-12 10:00"));
            assert!(prompt.contains("09:00–11:00"), "best hours are passed on");
            Ok(self.0.clone())
        }
    }

    #[test]
    fn keeps_only_proposals_that_fit() {
        let answer = json!({ "proposals": [
            proposal("b", "2026-10-13", "09:00", 30),
            proposal("a", "2026-10-12", "11:30", 60),   // overlaps the meeting
            proposal("a", "2026-10-12", "12:00", 60),   // fits
            proposal("a", "2026-10-13", "14:00", 60),   // the same task again
            proposal("c", "2026-10-12", "09:00", 30),   // already past (now is 10:00)
            proposal("c", "2026-10-12", "17:45", 30),   // runs past working hours
            proposal("c", "2026-10-12", "12:30", 30),   // overlaps "a"
            proposal("x", "2026-10-12", "15:00", 30),   // unknown task
            proposal("c", "2026-10-20", "10:00", 30),   // not a listed day
        ]});
        let fake = Fake(answer);
        let got = tauri::async_runtime::block_on(plan(&fake, &request())).unwrap();
        assert_eq!(
            got,
            vec![
                PlanProposal {
                    task_id: "a".into(),
                    date: "2026-10-12".into(),
                    start: "12:00".into(),
                    duration_minutes: 60
                },
                PlanProposal {
                    task_id: "b".into(),
                    date: "2026-10-13".into(),
                    start: "09:00".into(),
                    duration_minutes: 30
                },
            ]
        );
    }

    #[test]
    fn uses_the_task_length_when_the_ai_gives_a_silly_one() {
        let checked = check(&request()).unwrap();
        let got = keep_fitting(
            &json!({ "proposals": [proposal("a", "2026-10-13", "09:00", 2)] }),
            &checked,
        );
        assert_eq!(got[0].duration_minutes, 60);
        let got = keep_fitting(
            &json!({ "proposals": [proposal("b", "2026-10-13", "09:00", 9999)] }),
            &checked,
        );
        assert_eq!(got[0].duration_minutes, DEFAULT_MINUTES);
    }

    #[test]
    fn refuses_requests_it_cannot_plan() {
        let mut empty = request();
        empty.tasks.clear();
        assert!(matches!(check(&empty), Err(AppError::Ai("nothingToPlan"))));
        let mut hours = request();
        hours.day_end = "08:00".into();
        assert!(check(&hours).is_err());
        let mut long = request();
        long.instruction = "x".repeat(INSTRUCTION_MAX + 1);
        assert!(check(&long).is_err());
        assert!(keep_fitting(&json!({ "nope": 1 }), &check(&request()).unwrap()).is_empty());
    }
}
