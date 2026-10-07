use rusqlite::Connection;

use crate::error::AppResult;
use crate::repo::{areas, settings};
use crate::util::{new_id, now_utc};

/// Set once the defaults have been created, so deleting every area never brings them back.
const SEEDED_KEY: &str = "seed.defaultAreas";

/// DESIGN_SYSTEM §3.3: name, colour token key, Lucide icon name.
const DEFAULT_AREAS: [(&str, &str, &str); 5] = [
    ("Work", "area.work", "briefcase"),
    ("Home", "area.home", "house"),
    ("Personal", "area.personal", "heart"),
    ("Learning", "area.learning", "graduation-cap"),
    ("Health", "area.health", "activity"),
];

/// Creates the five default life areas on first run, in a single transaction.
pub fn seed_defaults(conn: &mut Connection) -> AppResult<()> {
    let tx = conn.transaction()?;
    if settings::get(&tx, SEEDED_KEY)?.is_none() {
        let now = now_utc();
        for (index, (name, color, icon)) in DEFAULT_AREAS.iter().enumerate() {
            let id = new_id();
            areas::insert(
                &tx,
                &areas::NewArea {
                    id: &id,
                    name,
                    color,
                    icon,
                    sort_order: i64::try_from(index).unwrap_or(i64::MAX),
                    now: &now,
                },
            )?;
        }
        settings::set(&tx, SEEDED_KEY, "true")?;
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::test_support::migrated_conn;

    #[test]
    fn seeds_the_five_default_areas_in_order() {
        let mut conn = migrated_conn();
        seed_defaults(&mut conn).unwrap();
        assert_eq!(
            areas::active_names(&conn).unwrap(),
            ["Work", "Home", "Personal", "Learning", "Health"]
        );
    }

    #[test]
    fn seeding_twice_does_not_duplicate() {
        let mut conn = migrated_conn();
        seed_defaults(&mut conn).unwrap();
        seed_defaults(&mut conn).unwrap();
        assert_eq!(areas::active_names(&conn).unwrap().len(), 5);
    }

    #[test]
    fn deleted_defaults_are_not_recreated() {
        let mut conn = migrated_conn();
        seed_defaults(&mut conn).unwrap();
        conn.execute("DELETE FROM areas", []).unwrap();
        seed_defaults(&mut conn).unwrap();
        assert!(areas::active_names(&conn).unwrap().is_empty());
    }
}
