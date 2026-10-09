//! Feedback loop (PRD R19, P3-T07): a personal wishlist kept on this computer. It leaves only
//! when the user exports it to a file or sends it by email themselves.

use std::path::Path;

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::i18n::t;
use crate::models::feedback::{Feedback, FeedbackInput};
use crate::repo::feedback as repo;
use crate::services::portability::write_file;
use crate::util::{new_id, now_utc};

/// Where "Email to the developer" goes. Temporary: the final address (or a setting for it)
/// is still to be decided (TASKS P3-T07a).
pub const DEVELOPER_EMAIL: &str = "ibrahimhere1995@gmail.com";
const KINDS: [&str; 3] = ["idea", "frustration", "bug"];
const STATUSES: [&str; 3] = ["open", "planned", "done"];
const TEXT_MAX: usize = 2000;
const CONTEXT_MAX: usize = 60;
/// Mail apps cut very long `mailto:` links; past this the email points to the export.
const MAILTO_BODY_MAX: usize = 1500;

fn valid(input: &FeedbackInput) -> AppResult<(String, String, Option<String>)> {
    if !KINDS.contains(&input.kind.as_str()) {
        return Err(AppError::invalid("kind", "outOfRange"));
    }
    let text = input.text.trim();
    if text.is_empty() {
        return Err(AppError::invalid("text", "required"));
    }
    if text.chars().count() > TEXT_MAX {
        return Err(AppError::invalid("text", "tooLong"));
    }
    let context = input
        .context
        .as_deref()
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .map(|c| c.chars().take(CONTEXT_MAX).collect());
    Ok((input.kind.clone(), text.to_owned(), context))
}

fn active(conn: &Connection, id: &str) -> AppResult<Feedback> {
    match repo::get(conn, id)? {
        Some((entry, false)) => Ok(entry),
        _ => Err(AppError::NotFound),
    }
}

pub fn list(conn: &Connection) -> AppResult<Vec<Feedback>> {
    Ok(repo::list_active(conn)?)
}

pub fn create(conn: &Connection, input: &FeedbackInput) -> AppResult<Feedback> {
    let (kind, text, context) = valid(input)?;
    let entry = Feedback {
        id: new_id(),
        kind,
        text,
        context,
        status: "open".into(),
        created_at: now_utc(),
    };
    repo::insert(conn, &entry)?;
    Ok(entry)
}

pub fn update(conn: &Connection, id: &str, input: &FeedbackInput) -> AppResult<Feedback> {
    let (kind, text, context) = valid(input)?;
    let entry = Feedback {
        kind,
        text,
        context,
        ..active(conn, id)?
    };
    repo::update(conn, &entry, &now_utc())?;
    Ok(entry)
}

pub fn set_status(conn: &Connection, id: &str, status: &str) -> AppResult<Feedback> {
    if !STATUSES.contains(&status) {
        return Err(AppError::invalid("status", "outOfRange"));
    }
    let entry = Feedback {
        status: status.to_owned(),
        ..active(conn, id)?
    };
    repo::update(conn, &entry, &now_utc())?;
    Ok(entry)
}

/// Soft delete; `deleted: false` restores (Undo).
pub fn set_deleted(conn: &Connection, id: &str, deleted: bool) -> AppResult<()> {
    if repo::get(conn, id)?.is_none() {
        return Err(AppError::NotFound);
    }
    let now = now_utc();
    repo::set_deleted(conn, id, deleted.then_some(now.as_str()), &now)?;
    Ok(())
}

/// The wishlist as plain text, one line per entry.
pub fn as_text(entries: &[Feedback]) -> String {
    let mut out = format!("{}\n\n", t("feedback.exportTitle", &[]));
    for e in entries {
        let kind = t(&format!("feedback.kinds.{}", e.kind), &[]);
        let status = t(&format!("feedback.statuses.{}", e.status), &[]);
        let date = e.created_at.get(..10).unwrap_or(&e.created_at);
        out.push_str(&format!("[{kind} · {status} · {date}] {}", e.text));
        if let Some(context) = &e.context {
            out.push_str(&format!(" ({})", t("feedback.on", &[("screen", context)])));
        }
        out.push('\n');
    }
    out
}

pub fn export(conn: &Connection, path: &Path) -> AppResult<()> {
    write_file(path, &as_text(&list(conn)?))
}

fn percent_encode(text: &str) -> String {
    text.bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
                char::from(b).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect()
}

/// A `mailto:` link with the entries not yet done; long lists are shortened.
pub fn mailto(conn: &Connection) -> AppResult<String> {
    let entries: Vec<Feedback> = list(conn)?
        .into_iter()
        .filter(|e| e.status != "done")
        .collect();
    let mut body = as_text(&entries);
    if body.chars().count() > MAILTO_BODY_MAX {
        body = body.chars().take(MAILTO_BODY_MAX).collect();
        body.push_str(&format!("\n…\n{}", t("feedback.emailTruncated", &[])));
    }
    Ok(format!(
        "mailto:{DEVELOPER_EMAIL}?subject={}&body={}",
        percent_encode(&t("feedback.emailSubject", &[])),
        percent_encode(&body)
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;

    fn input(kind: &str, text: &str) -> FeedbackInput {
        FeedbackInput {
            kind: kind.into(),
            text: text.into(),
            context: Some("  Calendar ".into()),
        }
    }

    #[test]
    fn adds_edits_moves_and_deletes_entries() {
        let c = migrated_conn();
        let a = create(&c, &input("idea", "  Dark mode for the tray  ")).unwrap();
        assert_eq!(a.text, "Dark mode for the tray");
        assert_eq!(a.status, "open");
        assert_eq!(a.context.as_deref(), Some("Calendar"));

        let a = update(&c, &a.id, &input("bug", "Tray icon blurry")).unwrap();
        assert_eq!(a.kind, "bug");
        let a = set_status(&c, &a.id, "planned").unwrap();
        assert_eq!(list(&c).unwrap(), vec![a.clone()]);

        set_deleted(&c, &a.id, true).unwrap();
        assert!(list(&c).unwrap().is_empty());
        assert!(matches!(
            set_status(&c, &a.id, "done"),
            Err(AppError::NotFound)
        ));
        set_deleted(&c, &a.id, false).unwrap();
        assert_eq!(list(&c).unwrap(), vec![a]);
    }

    #[test]
    fn refuses_bad_input() {
        let c = migrated_conn();
        assert!(create(&c, &input("wish", "x")).is_err());
        assert!(create(&c, &input("idea", "   ")).is_err());
        assert!(create(&c, &input("idea", &"x".repeat(TEXT_MAX + 1))).is_err());
        let a = create(&c, &input("idea", "x")).unwrap();
        assert!(set_status(&c, &a.id, "someday").is_err());
        assert!(matches!(
            set_deleted(&c, "missing", true),
            Err(AppError::NotFound)
        ));
    }

    #[test]
    fn exports_text_and_builds_a_short_email() {
        let c = migrated_conn();
        create(&c, &input("idea", "Week numbers & colours")).unwrap();
        let done = create(&c, &input("bug", "Already fixed")).unwrap();
        set_status(&c, &done.id, "done").unwrap();

        let text = as_text(&list(&c).unwrap());
        assert!(text.contains("[Idea · Open · "), "{text}");
        assert!(
            text.contains("Week numbers & colours (on Calendar)"),
            "{text}"
        );

        let link = mailto(&c).unwrap();
        assert!(link.starts_with(&format!("mailto:{DEVELOPER_EMAIL}?subject=")));
        assert!(link.contains("Week%20numbers%20%26%20colours"));
        assert!(
            !link.contains("Already%20fixed"),
            "done entries stay out of the email"
        );

        for i in 0..60 {
            let long = format!("A fairly long idea, number {i}, to fill the email");
            create(&c, &input("idea", &long)).unwrap();
        }
        let link = mailto(&c).unwrap();
        assert!(link.contains("%E2%80%A6"), "a long list is shortened");
    }
}
