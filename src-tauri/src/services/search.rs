//! Global search (P2-T09, PRD R9): titles, notes, checklist steps and area names.

use std::collections::HashSet;

use chrono::{Local, Utc};
use rusqlite::Connection;
use serde::Serialize;

use crate::error::AppResult;
use crate::models::item::Item;
use crate::repo::search as repo;
use crate::services::series;

/// Most results returned (the palette shows them grouped by status).
pub const SEARCH_LIMIT: usize = 50;
/// Longer input is cut, and only the first words count.
const MAX_QUERY_CHARS: usize = 200;
const MAX_WORDS: usize = 8;

/// Where the query was found, so the palette can say why an item matched.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub enum MatchedIn {
    Title,
    Notes,
    Step,
    Area,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct SearchHit {
    pub item: Item,
    pub matched_in: MatchedIn,
}

/// The user's words, each as a prefix term ("dent" finds "dentist"), all required.
/// Every word is quoted, so FTS5 operators typed by the user are treated as plain text.
fn fts_query(words: &[String]) -> String {
    words
        .iter()
        .map(|w| format!("\"{}\"*", w.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" ")
}

fn words_of(query: &str) -> Vec<String> {
    query
        .chars()
        .take(MAX_QUERY_CHARS)
        .collect::<String>()
        .split_whitespace()
        .map(|w| w.replace('"', ""))
        .filter(|w| w.chars().any(char::is_alphanumeric))
        .take(MAX_WORDS)
        .collect()
}

/// `%text%` for LIKE, with `%`, `_` and `\` escaped.
fn like_contains(text: &str) -> String {
    let escaped: String = text
        .to_lowercase()
        .chars()
        .flat_map(|c| match c {
            '%' | '_' | '\\' => vec!['\\', c],
            _ => vec![c],
        })
        .collect();
    format!("%{escaped}%")
}

pub fn search(conn: &Connection, query: &str) -> AppResult<Vec<SearchHit>> {
    let words = words_of(query);
    if words.is_empty() {
        return Ok(Vec::new());
    }
    let fts = fts_query(&words);
    let limit = i64::try_from(SEARCH_LIMIT).unwrap_or(50);
    let lowered: Vec<String> = words.iter().map(|w| w.to_lowercase()).collect();

    let mut found: Vec<(Item, MatchedIn)> = Vec::new();
    for item in repo::items_matching(conn, &fts, limit)? {
        let title = item.title.to_lowercase();
        let place = if lowered.iter().any(|w| title.contains(w.as_str())) {
            MatchedIn::Title
        } else {
            MatchedIn::Notes
        };
        found.push((item, place));
    }
    for item in repo::items_with_matching_steps(conn, &fts, limit)? {
        found.push((item, MatchedIn::Step));
    }
    let area_text = words.join(" ");
    for item in repo::open_items_in_matching_areas(conn, &like_contains(&area_text), limit)? {
        found.push((item, MatchedIn::Area));
    }

    let now = Utc::now();
    let mut seen = HashSet::new();
    let mut hits = Vec::new();
    for (item, matched_in) in found {
        // Finished occurrences of a routine would repeat its title many times: the series
        // itself stands for them.
        let finished = item.completed_at.is_some() || item.skipped_at.is_some();
        if (item.recurrence_parent_id.is_some() && finished) || !seen.insert(item.id.clone()) {
            continue;
        }
        // A repeating series is shown as its next occurrence (or its first).
        let item = if item.rrule.is_some() && item.recurrence_parent_id.is_none() {
            series::upcoming_or_first(conn, &Local, &item, now)?
        } else {
            item
        };
        hits.push(SearchHit { item, matched_in });
        if hits.len() == SEARCH_LIMIT {
            break;
        }
    }
    Ok(hits)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;
    use crate::models::checklist::ChecklistEntryInput;
    use crate::models::inputs::ItemInput;
    use crate::models::item::ItemKind;
    use crate::services::seed::seed_defaults;
    use crate::services::{checklist, items};

    fn add(c: &mut Connection, title: &str, notes: Option<&str>) -> Item {
        items::create(
            c,
            &ItemInput {
                kind: ItemKind::Task,
                title: title.into(),
                notes: notes.map(Into::into),
                area_id: None,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: Some("2030-01-07".into()),
                location: None,
                source: None,
                reminders: Some(vec![]),
                rrule: None,
            },
        )
        .unwrap()
    }

    fn found(c: &Connection, q: &str) -> Vec<(String, MatchedIn)> {
        search(c, q)
            .unwrap()
            .into_iter()
            .map(|h| (h.item.title, h.matched_in))
            .collect()
    }

    #[test]
    fn finds_titles_notes_and_word_starts() {
        let mut c = migrated_conn();
        add(&mut c, "Call the dentist", None);
        add(&mut c, "Bank visit", Some("bring the dental card"));
        add(&mut c, "Gym", None);
        let hits = found(&c, "dent");
        assert_eq!(hits.len(), 2);
        assert!(hits.contains(&("Call the dentist".into(), MatchedIn::Title)));
        assert!(hits.contains(&("Bank visit".into(), MatchedIn::Notes)));
        assert_eq!(
            found(&c, "call dent"),
            [("Call the dentist".into(), MatchedIn::Title)],
            "all words"
        );
    }

    #[test]
    fn finds_steps_and_areas() {
        let mut c = migrated_conn();
        seed_defaults(&mut c).unwrap();
        let trip = add(&mut c, "Plan trip", None);
        checklist::set_checklist(
            &mut c,
            &trip.id,
            &[ChecklistEntryInput {
                id: None,
                text: "Book flights".into(),
                done: false,
            }],
        )
        .unwrap();
        assert_eq!(
            found(&c, "flights"),
            [("Plan trip".into(), MatchedIn::Step)]
        );

        let health = c
            .query_row("SELECT id FROM areas WHERE name = 'Health'", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();
        items::create(
            &mut c,
            &ItemInput {
                area_id: Some(health),
                ..ItemInput {
                    kind: ItemKind::Task,
                    title: "Stretch".into(),
                    notes: None,
                    area_id: None,
                    priority: 0,
                    start_at: None,
                    end_at: None,
                    due_date: None,
                    location: None,
                    source: None,
                    reminders: Some(vec![]),
                    rrule: None,
                }
            },
        )
        .unwrap();
        assert_eq!(found(&c, "heal"), [("Stretch".into(), MatchedIn::Area)]);
    }

    #[test]
    fn ignores_the_trash_and_odd_input() {
        let mut c = migrated_conn();
        let gone = add(&mut c, "Old dentist note", None);
        items::delete(&mut c, &gone.id).unwrap();
        assert!(found(&c, "dentist").is_empty());
        // Operators and quotes are plain text, never FTS syntax errors.
        add(&mut c, "Fix NEAR door", None);
        assert_eq!(found(&c, "NEAR").len(), 1);
        for odd in ["", "   ", "\"", "*", "AND OR NOT", "(", "-x", "100%", "a_b"] {
            assert!(search(&c, odd).is_ok(), "{odd:?} must not fail");
        }
    }

    #[test]
    fn repeating_items_show_as_an_occurrence() {
        let mut c = migrated_conn();
        items::create(
            &mut c,
            &ItemInput {
                rrule: Some("FREQ=WEEKLY".into()),
                kind: ItemKind::Task,
                title: "Bins".into(),
                notes: None,
                area_id: None,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: Some("2030-01-07".into()),
                location: None,
                source: None,
                reminders: Some(vec![]),
            },
        )
        .unwrap();
        let first = search(&c, "bins").unwrap();
        items::complete(&mut c, &first[0].item.id).unwrap();
        let hits = search(&c, "bins").unwrap();
        assert_eq!(hits.len(), 1, "done occurrences don't repeat the series");
        assert!(
            hits[0].item.id.contains('@'),
            "an occurrence id, so it opens like any item"
        );
    }
}
