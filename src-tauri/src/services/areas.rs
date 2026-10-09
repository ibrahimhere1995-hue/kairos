//! Life areas (PRD §3, P2-T10): add, rename, recolour, reorder, archive.
//! Areas are never deleted from here: archiving hides an area from pickers while its items
//! keep showing it.

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::models::area::{Area, AreaInput};
use crate::repo::areas as repo;
use crate::util::{new_id, now_utc};

/// The colours an area can have: the DESIGN_SYSTEM §3.3 area tokens.
pub const AREA_COLORS: [&str; 5] = [
    "area.work",
    "area.home",
    "area.personal",
    "area.learning",
    "area.health",
];
pub const NAME_MAX_CHARS: usize = 40;
pub const MAX_AREAS: usize = 20;
/// Icon for areas created by the user (the defaults have their own).
const NEW_AREA_ICON: &str = "circle";

pub fn list(conn: &Connection) -> AppResult<Vec<Area>> {
    Ok(repo::list_all(conn)?)
}

/// Trimmed, non-empty, not too long, and not already used by another area (any case),
/// since Quick Capture finds areas by name (`#home`).
fn valid_name(conn: &Connection, name: &str, except_id: Option<&str>) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::invalid("name", "required"));
    }
    if name.chars().count() > NAME_MAX_CHARS {
        return Err(AppError::invalid("name", "tooLong"));
    }
    let taken = repo::list_all(conn)?
        .iter()
        .any(|a| Some(a.id.as_str()) != except_id && a.name.to_lowercase() == name.to_lowercase());
    if taken {
        return Err(AppError::invalid("name", "duplicateName"));
    }
    Ok(name.to_owned())
}

fn valid_color(color: &str) -> AppResult<String> {
    if AREA_COLORS.contains(&color) {
        Ok(color.to_owned())
    } else {
        Err(AppError::invalid("color", "outOfRange"))
    }
}

fn load(conn: &Connection, id: &str) -> AppResult<Area> {
    repo::list_all(conn)?
        .into_iter()
        .find(|a| a.id == id)
        .ok_or(AppError::NotFound)
}

pub fn create(conn: &mut Connection, input: &AreaInput) -> AppResult<Area> {
    let tx = conn.transaction()?;
    let existing = repo::list_all(&tx)?;
    if existing.len() >= MAX_AREAS {
        return Err(AppError::invalid("name", "tooMany"));
    }
    let name = valid_name(&tx, &input.name, None)?;
    let color = valid_color(&input.color)?;
    let id = new_id();
    let sort_order = existing
        .iter()
        .map(|a| a.sort_order)
        .max()
        .map_or(0, |m| m + 1);
    repo::insert(
        &tx,
        &repo::NewArea {
            id: &id,
            name: &name,
            color: &color,
            icon: NEW_AREA_ICON,
            sort_order: i64::from(sort_order),
            now: &now_utc(),
        },
    )?;
    let area = load(&tx, &id)?;
    tx.commit()?;
    Ok(area)
}

/// Rename and/or recolour.
pub fn update(conn: &mut Connection, id: &str, input: &AreaInput) -> AppResult<Area> {
    let tx = conn.transaction()?;
    let mut area = load(&tx, id)?;
    area.name = valid_name(&tx, &input.name, Some(id))?;
    area.color = valid_color(&input.color)?;
    repo::update(&tx, &area, &now_utc())?;
    tx.commit()?;
    Ok(area)
}

pub fn set_archived(conn: &mut Connection, id: &str, archived: bool) -> AppResult<Area> {
    let tx = conn.transaction()?;
    let mut area = load(&tx, id)?;
    area.is_archived = archived;
    repo::update(&tx, &area, &now_utc())?;
    tx.commit()?;
    Ok(area)
}

/// New display order: `ids` must list every area exactly once.
pub fn reorder(conn: &mut Connection, ids: &[String]) -> AppResult<Vec<Area>> {
    let tx = conn.transaction()?;
    let areas = repo::list_all(&tx)?;
    let mut wanted: Vec<&str> = ids.iter().map(String::as_str).collect();
    let mut have: Vec<&str> = areas.iter().map(|a| a.id.as_str()).collect();
    wanted.sort_unstable();
    have.sort_unstable();
    if wanted != have {
        return Err(AppError::invalid("ids", "outOfRange"));
    }
    let now = now_utc();
    for mut area in areas {
        let position = ids.iter().position(|id| *id == area.id).unwrap_or(0);
        area.sort_order = i32::try_from(position).unwrap_or(i32::MAX);
        repo::update(&tx, &area, &now)?;
    }
    let saved = repo::list_all(&tx)?;
    tx.commit()?;
    Ok(saved)
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

    fn input(name: &str, color: &str) -> AreaInput {
        AreaInput {
            name: name.into(),
            color: color.into(),
        }
    }

    fn names(areas: &[Area]) -> Vec<&str> {
        areas.iter().map(|a| a.name.as_str()).collect()
    }

    fn reason(err: AppError) -> &'static str {
        match err {
            AppError::Validation { reason, .. } => reason,
            other => panic!("expected a validation error, got {other:?}"),
        }
    }

    #[test]
    fn adds_an_area_at_the_end() {
        let mut c = conn();
        let family = create(&mut c, &input("  Family ", "area.home")).unwrap();
        assert_eq!(family.name, "Family");
        assert_eq!(family.icon, "circle");
        assert_eq!(names(&list(&c).unwrap()).last(), Some(&"Family"));
    }

    #[test]
    fn rejects_bad_names_and_colours() {
        let mut c = conn();
        assert_eq!(
            reason(create(&mut c, &input("  ", "area.home")).unwrap_err()),
            "required"
        );
        assert_eq!(
            reason(create(&mut c, &input(&"x".repeat(41), "area.home")).unwrap_err()),
            "tooLong"
        );
        assert_eq!(
            reason(create(&mut c, &input("work", "area.home")).unwrap_err()),
            "duplicateName"
        );
        assert_eq!(
            reason(create(&mut c, &input("Fun", "#ff0000")).unwrap_err()),
            "outOfRange"
        );
        for n in 0..(MAX_AREAS - 5) {
            create(&mut c, &input(&format!("Area {n}"), "area.work")).unwrap();
        }
        assert_eq!(
            reason(create(&mut c, &input("One more", "area.work")).unwrap_err()),
            "tooMany"
        );
    }

    #[test]
    fn renames_and_recolours() {
        let mut c = conn();
        let work = list(&c).unwrap()[0].clone();
        let job = update(&mut c, &work.id, &input("Job", "area.learning")).unwrap();
        assert_eq!(
            (job.name.as_str(), job.color.as_str()),
            ("Job", "area.learning")
        );
        // Keeping its own name (in another case) is fine.
        assert!(update(&mut c, &work.id, &input("JOB", "area.learning")).is_ok());
        assert_eq!(
            reason(update(&mut c, &work.id, &input("Home", "area.work")).unwrap_err()),
            "duplicateName"
        );
        assert!(matches!(
            update(&mut c, "missing", &input("X", "area.work")),
            Err(AppError::NotFound)
        ));
    }

    #[test]
    fn archived_areas_stay_listed_but_leave_pickers() {
        let mut c = conn();
        let home = list(&c).unwrap()[1].clone();
        assert!(set_archived(&mut c, &home.id, true).unwrap().is_archived);
        assert!(
            list(&c)
                .unwrap()
                .iter()
                .any(|a| a.id == home.id && a.is_archived)
        );
        assert!(!repo::active_names(&c).unwrap().contains(&"Home".to_owned()));
        assert!(!set_archived(&mut c, &home.id, false).unwrap().is_archived);
    }

    #[test]
    fn reorders_every_area() {
        let mut c = conn();
        let mut ids: Vec<String> = list(&c).unwrap().into_iter().map(|a| a.id).collect();
        ids.reverse();
        let saved = reorder(&mut c, &ids).unwrap();
        assert_eq!(
            names(&saved),
            ["Health", "Learning", "Personal", "Home", "Work"]
        );
        assert!(reorder(&mut c, &ids[1..]).is_err(), "must list every area");
        let mut dup = ids.clone();
        dup[0] = dup[1].clone();
        assert!(reorder(&mut c, &dup).is_err());
    }
}
