//! A2 — smart natural language (PRD §7.3): sentences the offline parser can't handle,
//! e.g. "remind me two days before mum's birthday on the 14th". Only the typed sentence and
//! the current local date and time are sent.

use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use serde_json::{Value, json};

use crate::ai::{AiProvider, Part};
use crate::error::{AppError, AppResult};
use crate::models::ai::AiDraft;

pub const TEXT_MAX: usize = 500;
const TITLE_MAX: usize = 200;
const DURATION_MAX: i64 = 24 * 60;
const REMINDER_MAX: i64 = 30 * 24 * 60;

fn schema() -> Value {
    let maybe = |kind: &str| json!({ "type": kind, "nullable": true });
    json!({
        "type": "OBJECT",
        "properties": {
            "title": { "type": "STRING" },
            "date": maybe("STRING"),
            "time": maybe("STRING"),
            "durationMinutes": maybe("INTEGER"),
            "reminderMinutesBefore": maybe("INTEGER"),
        },
        "required": ["title"],
    })
}

fn prompt(text: &str, now: NaiveDateTime) -> String {
    format!(
        "You turn one sentence into a planner task. It is now {} (local time).\n\
         Return JSON with:\n\
         - title: a short task title in the sentence's language, without the date, time or \
           reminder words (e.g. \"Mum's birthday\").\n\
         - date: the day it happens, YYYY-MM-DD, or null if none is given.\n\
         - time: 24-hour HH:MM if a time is given, else null.\n\
         - durationMinutes: only if a length or end time is given, else null.\n\
         - reminderMinutesBefore: only if the sentence asks for a reminder before it, in \
           minutes (two days before = 2880), else null.\n\
         Never invent details that are not in the sentence.\n\
         Sentence: {text:?}",
        now.format("%A %Y-%m-%d %H:%M"),
    )
}

pub(super) fn string(value: &Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(str::trim).map(str::to_owned)
}

pub(super) fn within(value: &Value, key: &str, max: i64) -> Option<i64> {
    value.get(key)?.as_i64().filter(|n| (1..=max).contains(n))
}

/// A well-formed `date` (YYYY-MM-DD), `time` (HH:MM, only with a date) and
/// `durationMinutes` (only with a time, at most a day).
pub(super) fn moment(value: &Value) -> (Option<String>, Option<String>, Option<i64>) {
    let date = string(value, "date")
        .and_then(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok())
        .map(|d| d.format("%Y-%m-%d").to_string());
    let time = string(value, "time")
        .filter(|_| date.is_some())
        .and_then(|t| NaiveTime::parse_from_str(&t, "%H:%M").ok())
        .map(|t| t.format("%H:%M").to_string());
    let duration = time
        .as_ref()
        .and(within(value, "durationMinutes", DURATION_MAX));
    (date, time, duration)
}

/// The local date and time the frontend sends, `YYYY-MM-DDTHH:mm`.
pub(super) fn local_now(now: &str) -> AppResult<NaiveDateTime> {
    NaiveDateTime::parse_from_str(now, "%Y-%m-%dT%H:%M")
        .map_err(|_| AppError::invalid("now", "invalidDateTime"))
}

/// Keeps only what is well formed; the sentence itself is the title if none came back.
pub fn validate(value: &Value, text: &str) -> AiDraft {
    let title = string(value, "title")
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| text.trim().to_owned())
        .chars()
        .take(TITLE_MAX)
        .collect();
    let (date, time, duration_minutes) = moment(value);
    AiDraft {
        duration_minutes,
        reminder_minutes: within(value, "reminderMinutesBefore", REMINDER_MAX),
        title,
        date,
        time,
    }
}

/// `now` is the local date and time, `YYYY-MM-DDTHH:mm`.
pub async fn read_sentence(
    provider: &impl AiProvider,
    text: &str,
    now: &str,
) -> AppResult<AiDraft> {
    let text = text.trim();
    if text.is_empty() {
        return Err(AppError::invalid("text", "required"));
    }
    if text.chars().count() > TEXT_MAX {
        return Err(AppError::invalid("text", "tooLong"));
    }
    let now = local_now(now)?;
    let answer = provider
        .generate_json(&[Part::Text(prompt(text, now))], &schema())
        .await?;
    Ok(validate(&answer, text))
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fake(Value);

    impl AiProvider for Fake {
        async fn generate_json(&self, parts: &[Part], _schema: &Value) -> AppResult<Value> {
            let [Part::Text(prompt)] = parts else {
                panic!("only text is sent");
            };
            assert!(prompt.contains("Friday 2026-10-09 14:05"), "{prompt}");
            assert!(!prompt.contains("notes"), "only the sentence is sent");
            Ok(self.0.clone())
        }
    }

    fn run(fake: Value, text: &str) -> AppResult<AiDraft> {
        tauri::async_runtime::block_on(read_sentence(&Fake(fake), text, "2026-10-09T14:05"))
    }

    #[test]
    fn reads_a_sentence_into_a_draft() {
        let draft = run(
            json!({ "title": "Mum's birthday", "date": "2026-10-14", "time": null,
                    "durationMinutes": null, "reminderMinutesBefore": 2880 }),
            "remind me two days before mum's birthday on the 14th",
        )
        .unwrap();
        assert_eq!(
            draft,
            AiDraft {
                title: "Mum's birthday".into(),
                date: Some("2026-10-14".into()),
                time: None,
                duration_minutes: None,
                reminder_minutes: Some(2880),
            }
        );
    }

    #[test]
    fn keeps_only_well_formed_parts() {
        let draft = validate(
            &json!({ "title": "  ", "date": "14/10/2026", "time": "3pm",
                     "durationMinutes": 90, "reminderMinutesBefore": -5 }),
            "  Dentist on the 14th  ",
        );
        assert_eq!(draft.title, "Dentist on the 14th");
        assert_eq!((draft.date, draft.time), (None, None));
        assert_eq!(
            (draft.duration_minutes, draft.reminder_minutes),
            (None, None)
        );

        let draft = validate(
            &json!({ "title": "Gym", "date": "2026-10-12", "time": "07:30",
                     "durationMinutes": 5000 }),
            "x",
        );
        assert_eq!(draft.time.as_deref(), Some("07:30"));
        assert_eq!(draft.duration_minutes, None, "longer than a day is dropped");
        assert_eq!(
            validate(&json!({ "time": "07:30" }), "Gym").time,
            None,
            "no time without a date"
        );
    }

    #[test]
    fn refuses_empty_or_long_text_and_bad_clock() {
        assert!(run(json!({}), "   ").is_err());
        assert!(run(json!({}), &"x".repeat(TEXT_MAX + 1)).is_err());
        let bad_now =
            tauri::async_runtime::block_on(read_sentence(&Fake(json!({})), "Gym", "noon"));
        assert!(bad_now.is_err());
    }
}
