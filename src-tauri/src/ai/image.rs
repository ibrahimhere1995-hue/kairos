//! A1 — screenshot / image → task (PRD §7.3). Only the picture (already shrunk to at most
//! 1600 px by the frontend) and the local date and time are sent. The result pre-fills the
//! editor; the user checks it and saves.

use serde_json::{Value, json};

use crate::ai::parse::{local_now, moment, string};
use crate::ai::{AiProvider, Part};
use crate::error::{AppError, AppResult};
use crate::i18n::t;
use crate::models::ai::AiImageDraft;

/// Shrunk pictures are far smaller; this only stops mistakes.
pub const IMAGE_MAX_BYTES: usize = 8 * 1024 * 1024;
const TITLE_MAX: usize = 200;
const LOCATION_MAX: usize = 500;
const NOTES_MAX: usize = 2000;

fn mime_of(kind: &str) -> Option<&'static str> {
    match kind.to_ascii_lowercase().as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

fn schema() -> Value {
    let maybe = |kind: &str| json!({ "type": kind, "nullable": true });
    json!({
        "type": "OBJECT",
        "properties": {
            "title": { "type": "STRING" },
            "date": maybe("STRING"),
            "time": maybe("STRING"),
            "durationMinutes": maybe("INTEGER"),
            "location": maybe("STRING"),
            "notes": maybe("STRING"),
        },
        "required": ["title"],
    })
}

fn prompt(now: chrono::NaiveDateTime) -> String {
    format!(
        "This picture is something to act on: a meeting invite, ticket, receipt, letter, \
         poster or chat screenshot. Turn it into one planner task. It is now {} (local time).\n\
         Return JSON with:\n\
         - title: a short task title in the picture's language (e.g. \"Pay electricity bill\").\n\
         - date: YYYY-MM-DD of the day it happens or is due, or null.\n\
         - time: 24-hour HH:MM if a time is shown, else null.\n\
         - durationMinutes: only if an end time or length is shown, else null.\n\
         - location: the place or address if shown, else null.\n\
         - notes: other useful details (amount, reference number, who, link) in a few short \
           lines, else null.\n\
         Never invent details that are not in the picture.",
        now.format("%A %Y-%m-%d %H:%M"),
    )
}

fn limited(value: &Value, key: &str, max: usize) -> Option<String> {
    string(value, key)
        .filter(|s| !s.is_empty())
        .map(|s| s.chars().take(max).collect())
}

pub fn validate(value: &Value) -> AiImageDraft {
    let (date, time, duration_minutes) = moment(value);
    AiImageDraft {
        title: limited(value, "title", TITLE_MAX).unwrap_or_else(|| t("inbox.pictureTitle", &[])),
        date,
        time,
        duration_minutes,
        location: limited(value, "location", LOCATION_MAX),
        notes: limited(value, "notes", NOTES_MAX),
    }
}

/// `kind` is the image type (`png`, `jpeg`, `webp`); `now` = local `YYYY-MM-DDTHH:mm`.
pub async fn read_picture(
    provider: &impl AiProvider,
    bytes: Vec<u8>,
    kind: &str,
    now: &str,
) -> AppResult<AiImageDraft> {
    let mime = mime_of(kind).ok_or(AppError::Ai("imageType"))?;
    if bytes.is_empty() || bytes.len() > IMAGE_MAX_BYTES {
        return Err(AppError::Ai("imageSize"));
    }
    let now = local_now(now)?;
    let parts = [Part::Text(prompt(now)), Part::Image { mime, bytes }];
    let answer = provider.generate_json(&parts, &schema()).await?;
    Ok(validate(&answer))
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fake(Value);

    impl AiProvider for Fake {
        async fn generate_json(&self, parts: &[Part], _schema: &Value) -> AppResult<Value> {
            let [Part::Text(prompt), Part::Image { mime, bytes }] = parts else {
                panic!("a prompt and one picture");
            };
            assert!(prompt.contains("2026-10-09 14:05"));
            assert_eq!((*mime, bytes.as_slice()), ("image/png", &[1u8, 2, 3][..]));
            Ok(self.0.clone())
        }
    }

    fn run(kind: &str, bytes: Vec<u8>) -> AppResult<AiImageDraft> {
        let fake = Fake(json!({
            "title": "Dentist", "date": "2026-10-20", "time": "09:30",
            "durationMinutes": 45, "location": "12 High St", "notes": "  ",
        }));
        tauri::async_runtime::block_on(read_picture(&fake, bytes, kind, "2026-10-09T14:05"))
    }

    #[test]
    fn reads_a_picture_into_a_draft() {
        let draft = run("PNG", vec![1, 2, 3]).unwrap();
        assert_eq!(
            draft,
            AiImageDraft {
                title: "Dentist".into(),
                date: Some("2026-10-20".into()),
                time: Some("09:30".into()),
                duration_minutes: Some(45),
                location: Some("12 High St".into()),
                notes: None,
            }
        );
    }

    #[test]
    fn refuses_unknown_types_and_empty_or_huge_files() {
        assert!(run("gif", vec![1]).is_err());
        assert!(run("png", vec![]).is_err());
        assert!(run("png", vec![0; IMAGE_MAX_BYTES + 1]).is_err());
    }

    #[test]
    fn falls_back_to_a_plain_title() {
        assert_eq!(validate(&json!({ "title": "" })).title, "Picture");
    }
}
