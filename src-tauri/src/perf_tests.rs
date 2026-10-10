//! P4-T01 performance pass: a 50,000-item database and the queries every screen makes.
//! Not part of the normal run (it takes a while):
//! `cargo test --release perf_ -- --ignored --nocapture`

use std::time::{Duration, Instant};

use chrono::{Duration as Days, Local, NaiveDate, TimeZone, Utc};
use rusqlite::Connection;

use crate::db::{connection, migrations, test_support::scratch_path};
use crate::models::dashboard::DashboardQuery;
use crate::models::inputs::{DateRange, ItemFilters};
use crate::models::item::{Item, ItemKind, ItemSource};
use crate::repo;
use crate::services::{items, search, today, trash};
use crate::util::new_id;

const ITEMS: usize = 50_000;
/// PRD view-switch budget; each query must leave room for rendering.
const QUERY_BUDGET: Duration = Duration::from_millis(100);

fn iso(t: chrono::DateTime<Utc>) -> String {
    t.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// Two years of history and a year ahead: timed events and tasks, all-day tasks, Inbox
/// tasks, done and trashed ones. Deterministic, so runs compare.
fn seed(conn: &mut Connection, origin: NaiveDate) {
    let tx = conn.transaction().unwrap();
    let words = [
        "Report",
        "Call bank",
        "Gym",
        "Groceries",
        "Dentist",
        "Review",
        "Plan trip",
    ];
    for n in 0..ITEMS {
        let day = origin + Days::days((n % 1095) as i64 - 730);
        let hour = 8 + (n % 10) as u32;
        let start = Local
            .from_local_datetime(&day.and_hms_opt(hour, 0, 0).unwrap())
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let (kind, start_at, end_at, due_date) = match n % 4 {
            0 => (
                ItemKind::Event,
                Some(iso(start)),
                Some(iso(start + Days::hours(1))),
                None,
            ),
            1 => (
                ItemKind::Task,
                Some(iso(start)),
                Some(iso(start + Days::minutes(30))),
                None,
            ),
            2 => (
                ItemKind::Task,
                None,
                None,
                Some(day.format("%Y-%m-%d").to_string()),
            ),
            _ if n % 40 == 3 => (ItemKind::Task, None, None, None),
            _ => (
                ItemKind::Task,
                None,
                None,
                Some(day.format("%Y-%m-%d").to_string()),
            ),
        };
        let past = day < origin;
        let now = iso(Utc::now());
        let item = Item {
            id: new_id(),
            kind,
            title: format!("{} {n}", words[n % words.len()]),
            notes: (n % 5 == 0).then(|| "Some longer notes about this item".into()),
            area_id: None,
            priority: (n % 4) as i32,
            all_day: start_at.is_none(),
            start_at,
            end_at,
            due_date,
            completed_at: (past && n % 3 != 0).then(|| iso(start)),
            skipped_at: None,
            location: None,
            rrule: None,
            recurrence_parent_id: None,
            original_start_at: None,
            milestone_id: None,
            reschedule_count: 0,
            source: ItemSource::Manual,
            created_at: now.clone(),
            updated_at: now,
            deleted_at: (n % 97 == 0).then(|| iso(Utc::now())),
        };
        repo::items::insert(&tx, &item).unwrap();
    }
    tx.commit().unwrap();
}

fn timed<T>(label: &str, f: impl Fn() -> T) -> (Duration, T) {
    f(); // warm the cache, as a second visit to a screen would
    let start = Instant::now();
    let out = f();
    let took = start.elapsed();
    println!("{label:<34} {:>7.1} ms", took.as_secs_f64() * 1000.0);
    (took, out)
}

#[test]
#[ignore = "slow: run with --ignored --nocapture"]
fn perf_fifty_thousand_items() {
    // KAIROS_PERF_DB keeps the database (e.g. to start the app against it); else a scratch file.
    let keep = std::env::var_os("KAIROS_PERF_DB").map(std::path::PathBuf::from);
    let path = keep
        .clone()
        .unwrap_or_else(|| scratch_path("perf").with_extension("db"));
    // Never overwrite anything: a kept database must be a new file.
    assert!(
        !path.exists(),
        "{} already exists; choose a new file",
        path.display()
    );
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    let mut conn = Connection::open(&path).unwrap();
    connection::configure(&conn).unwrap();
    migrations::MIGRATIONS.to_latest(&mut conn).unwrap();

    let origin = Local::now().date_naive();
    let seeding = Instant::now();
    seed(&mut conn, origin);
    println!(
        "seeded {ITEMS} items in {:.1} s",
        seeding.elapsed().as_secs_f64()
    );

    let local = |d: NaiveDate| {
        iso(Local
            .from_local_datetime(&d.and_hms_opt(0, 0, 0).unwrap())
            .single()
            .unwrap()
            .with_timezone(&Utc))
    };
    let range = |from: NaiveDate, days: i64| DateRange {
        start: local(from),
        end: local(from + Days::days(days)),
        start_date: from.format("%Y-%m-%d").to_string(),
        end_date: (from + Days::days(days)).format("%Y-%m-%d").to_string(),
    };
    let filters = ItemFilters::default();
    let query = DashboardQuery {
        now: iso(Utc::now()),
        day_start: local(origin),
        day_end: local(origin + Days::days(1)),
        today: origin.format("%Y-%m-%d").to_string(),
        week_end: local(origin + Days::days(7)),
        week_end_date: (origin + Days::days(7)).format("%Y-%m-%d").to_string(),
    };

    let mut results = vec![
        timed("My Day (dashboard)", || {
            let d = items::dashboard(&conn, &query).unwrap();
            println!("  (slipped rows: {})", d.overdue.len());
            d.today.len()
        })
        .0,
        timed("Calendar day", || {
            items::list(&conn, &range(origin, 1), &filters)
                .unwrap()
                .len()
        })
        .0,
        timed("Calendar week", || {
            items::list(&conn, &range(origin, 7), &filters)
                .unwrap()
                .len()
        })
        .0,
        timed("Calendar month (6 weeks)", || {
            items::list(&conn, &range(origin, 42), &filters)
                .unwrap()
                .len()
        })
        .0,
        timed("Inbox / To schedule", || {
            items::unscheduled(&conn).unwrap().len()
        })
        .0,
        timed("Search \"report\"", || {
            search::search(&conn, "report").unwrap().len()
        })
        .0,
        timed("Tray / daily summary", || {
            today::overview(&conn, &Local, Utc::now())
                .unwrap()
                .next
                .is_some()
        })
        .0,
    ];
    let (trash_took, trashed) = timed("Trash", || trash::list(&conn).unwrap().len());
    results.push(trash_took);
    println!("trash holds {trashed} items");

    for (took, budget) in results.iter().zip(std::iter::repeat(QUERY_BUDGET)) {
        assert!(*took < budget, "a query took {took:?} (budget {budget:?})");
    }
    drop(conn);
    if keep.is_none() {
        let _ = std::fs::remove_file(&path);
    }
}
