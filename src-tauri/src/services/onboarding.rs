//! First launch (PRD R7, P2-T08): three skippable screens (name, theme, life areas) and
//! three sample tasks that teach by doing, removable in one click.

use chrono::{Duration, Local};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::error::AppResult;
use crate::i18n::t;
use crate::models::inputs::ItemInput;
use crate::models::item::{Item, ItemKind, ItemSource};
use crate::models::settings::ThemePreference;
use crate::repo::{areas, items as item_repo, settings};
use crate::services::{app_settings, items};
use crate::util::now_utc;

const DONE: &str = "onboarding.done";
const SAMPLE_IDS: &str = "onboarding.sampleIds";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct OnboardingStatus {
    /// Show the welcome screens (first launch, not finished or skipped yet).
    pub needed: bool,
    /// How many sample tasks are still around (for "Remove sample tasks").
    pub samples_left: usize,
}

/// The welcome screens' answers. Anything left out keeps its default.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(test, derive(ts_rs::TS), ts(export))]
pub struct OnboardingInput {
    pub name: String,
    pub theme: Option<ThemePreference>,
    /// Life areas to keep; the other default areas are archived (not deleted).
    pub keep_area_ids: Option<Vec<String>>,
}

fn sample_ids(conn: &Connection) -> AppResult<Vec<String>> {
    Ok(settings::get(conn, SAMPLE_IDS)?
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default())
}

fn live_samples(conn: &Connection) -> AppResult<Vec<Item>> {
    let mut live = Vec::new();
    for id in sample_ids(conn)? {
        if let Some(item) = item_repo::get(conn, &id)?.filter(|i| i.deleted_at.is_none()) {
            live.push(item);
        }
    }
    Ok(live)
}

pub fn status(conn: &Connection) -> AppResult<OnboardingStatus> {
    Ok(OnboardingStatus {
        needed: settings::get(conn, DONE)?.is_none(),
        samples_left: live_samples(conn)?.len(),
    })
}

fn has_any_items(conn: &Connection) -> AppResult<bool> {
    Ok(conn.query_row("SELECT EXISTS(SELECT 1 FROM items)", [], |r| r.get(0))?)
}

/// The sample tasks, only into an empty planner (never mixed into someone's real data).
fn add_samples(conn: &mut Connection) -> AppResult<()> {
    if has_any_items(conn)? {
        return Ok(());
    }
    let today = Local::now().date_naive();
    let tomorrow = today + Duration::days(1);
    let samples = [
        ("onboarding.samples.tick", today),
        ("onboarding.samples.capture", today),
        ("onboarding.samples.open", tomorrow),
    ];
    let mut ids = Vec::new();
    for (key, day) in samples {
        let item = items::create(
            conn,
            &ItemInput {
                kind: ItemKind::Task,
                title: t(key, &[]),
                notes: None,
                area_id: None,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: Some(day.format("%Y-%m-%d").to_string()),
                location: None,
                source: Some(ItemSource::Template),
                // Samples never send notifications.
                reminders: Some(vec![]),
                rrule: None,
                milestone_id: None,
            },
        )?;
        ids.push(item.id);
    }
    settings::set(
        conn,
        SAMPLE_IDS,
        &serde_json::to_string(&ids).unwrap_or_default(),
    )?;
    Ok(())
}

fn mark_done(conn: &Connection) -> AppResult<()> {
    settings::set(conn, DONE, "true")?;
    Ok(())
}

pub fn finish(conn: &mut Connection, input: &OnboardingInput) -> AppResult<OnboardingStatus> {
    let mut chosen = app_settings::get(conn)?;
    chosen.name = app_settings::valid_name(&input.name)?;
    if let Some(theme) = input.theme {
        chosen.theme = theme;
    }
    app_settings::update(conn, &chosen)?;

    if let Some(keep) = &input.keep_area_ids {
        let tx = conn.transaction()?;
        let now = now_utc();
        for mut area in areas::list_all(&tx)? {
            let archived = !keep.contains(&area.id);
            if area.is_archived != archived {
                area.is_archived = archived;
                areas::update(&tx, &area, &now)?;
            }
        }
        tx.commit()?;
    }
    add_samples(conn)?;
    mark_done(conn)?;
    status(conn)
}

/// "Skip": defaults stay, but the planner still starts with its sample tasks.
pub fn skip(conn: &mut Connection) -> AppResult<OnboardingStatus> {
    add_samples(conn)?;
    mark_done(conn)?;
    status(conn)
}

/// "Remove sample tasks": they go to the Trash (restorable), in one step.
pub fn remove_samples(conn: &mut Connection) -> AppResult<usize> {
    let live = live_samples(conn)?;
    for sample in &live {
        items::delete(conn, &sample.id)?;
    }
    Ok(live.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;
    use crate::services::seed::seed_defaults;

    fn conn() -> Connection {
        let mut c = migrated_conn();
        seed_defaults(&mut c).unwrap();
        c
    }

    #[test]
    fn first_launch_needs_onboarding_once() {
        let mut c = conn();
        assert!(status(&c).unwrap().needed);
        let after = skip(&mut c).unwrap();
        assert!(!after.needed);
        assert_eq!(
            after.samples_left, 3,
            "skipping still gives the sample tasks"
        );
    }

    #[test]
    fn finishing_saves_the_answers_and_archives_unticked_areas() {
        let mut c = conn();
        let all = areas::list_all(&c).unwrap();
        let keep = vec![all[0].id.clone(), all[1].id.clone()];
        let done = finish(
            &mut c,
            &OnboardingInput {
                name: "  Zack ".into(),
                theme: Some(ThemePreference::Dark),
                keep_area_ids: Some(keep),
            },
        )
        .unwrap();
        assert!(!done.needed);
        let saved = app_settings::get(&c).unwrap();
        assert_eq!(saved.name, "Zack");
        assert_eq!(saved.theme, ThemePreference::Dark);
        let archived: Vec<bool> = areas::list_all(&c)
            .unwrap()
            .iter()
            .map(|a| a.is_archived)
            .collect();
        assert_eq!(archived, [false, false, true, true, true]);
    }

    #[test]
    fn samples_only_go_into_an_empty_planner() {
        let mut c = conn();
        items::create(
            &mut c,
            &ItemInput {
                kind: ItemKind::Task,
                title: "My real task".into(),
                notes: None,
                area_id: None,
                priority: 0,
                start_at: None,
                end_at: None,
                due_date: None,
                location: None,
                source: None,
                reminders: None,
                rrule: None,
                milestone_id: None,
            },
        )
        .unwrap();
        assert_eq!(skip(&mut c).unwrap().samples_left, 0);
    }

    #[test]
    fn samples_are_removed_to_the_trash_in_one_step() {
        let mut c = conn();
        skip(&mut c).unwrap();
        let titles: Vec<String> = live_samples(&c)
            .unwrap()
            .into_iter()
            .map(|i| i.title)
            .collect();
        assert!(
            titles.iter().all(|t| !t.starts_with("onboarding.")),
            "real text, not keys: {titles:?}"
        );
        assert_eq!(remove_samples(&mut c).unwrap(), 3);
        assert_eq!(status(&c).unwrap().samples_left, 0);
        let in_trash: i64 = c
            .query_row(
                "SELECT COUNT(*) FROM items WHERE deleted_at IS NOT NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(in_trash, 3, "restorable from the Trash");
    }

    #[test]
    fn a_too_long_name_is_refused() {
        let mut c = conn();
        let err = finish(
            &mut c,
            &OnboardingInput {
                name: "x".repeat(41),
                theme: None,
                keep_area_ids: None,
            },
        );
        assert!(err.is_err());
        assert!(status(&c).unwrap().needed, "nothing finished");
    }
}
