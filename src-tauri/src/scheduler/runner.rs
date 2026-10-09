//! The reminder loop (ARCHITECTURE §6.2): one background thread that wakes at the next
//! reminder (at most every 30 s, so sleep/wake and clock changes are noticed quickly),
//! fires what is due, sends the daily summary, and keeps the tray's next item current.

use std::time::Duration as StdDuration;

use chrono::{Local, Offset, Utc};
use tauri::{AppHandle, Manager};

use crate::commands::focus::FocusMute;
use crate::commands::with_conn;
use crate::db::Db;
use crate::models::reminder::DueReminder;
use crate::scheduler::{messages, timing};
use crate::services::{app_settings, reminders, today};
use crate::{notify, tray};

const MAX_SLEEP: StdDuration = StdDuration::from_secs(30);
const MIN_SLEEP: StdDuration = StdDuration::from_millis(500);

fn local_offset_seconds() -> i32 {
    Local::now().offset().fix().local_minus_utc()
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let mut offset = local_offset_seconds();
        loop {
            tick(&app, &mut offset);
            std::thread::sleep(next_sleep(&app));
        }
    });
}

/// Until the next reminder is due, but never longer than `MAX_SLEEP`.
fn next_sleep(app: &AppHandle) -> StdDuration {
    let next = app
        .try_state::<Db>()
        .and_then(|db| with_conn(&db, |conn| reminders::next_fire_at(conn)).ok())
        .flatten();
    match next.map(|at| (at - Utc::now()).to_std()) {
        Some(Ok(wait)) => wait.clamp(MIN_SLEEP, MAX_SLEEP),
        Some(Err(_)) => MIN_SLEEP, // already due
        None => MAX_SLEEP,
    }
}

fn tick(app: &AppHandle, last_offset: &mut i32) {
    let Some(db) = app.try_state::<Db>() else {
        return;
    };

    // Time zone (or DST rule) changed: date-only reminders move with the local day.
    let offset = local_offset_seconds();
    if offset != *last_offset {
        *last_offset = offset;
        let result = with_conn(&db, |conn| {
            let clock = reminders::Clock::current(conn)?;
            reminders::recompute_waiting(conn, &clock)
        });
        if let Err(error) = result {
            eprintln!("Reminder recompute failed: {error}");
        }
    }

    // Focus mode holds notifications; whatever came due arrives once it ends (PRD R16).
    if app.try_state::<FocusMute>().is_some_and(|m| m.is_on()) {
        tray::refresh(app);
        return;
    }

    let now = Utc::now();
    match with_conn(&db, |conn| reminders::take_due(conn, now)) {
        Ok(due) => announce(app, now, due),
        Err(error) => eprintln!("Reminder check failed: {error}"),
    }

    daily_summary(app, &db, now);
    tray::refresh(app);
}

/// On-time reminders are shown one by one; several missed ones (computer asleep or off)
/// become one "While you were away" notification.
fn announce(app: &AppHandle, now: chrono::DateTime<Utc>, due: Vec<DueReminder>) {
    let (missed, on_time): (Vec<_>, Vec<_>) = due.into_iter().partition(|d| {
        chrono::DateTime::parse_from_rfc3339(&d.fire_at)
            .is_ok_and(|at| timing::is_missed(at.with_timezone(&Utc), now))
    });
    for entry in &on_time {
        notify::show(app, messages::reminder(&Local, now, entry));
    }
    match missed.as_slice() {
        [] => {}
        [single] => notify::show(app, messages::reminder(&Local, now, single)),
        several => notify::show(app, messages::away(several)),
    }
}

fn daily_summary(app: &AppHandle, db: &Db, now: chrono::DateTime<Utc>) {
    let notice = with_conn(db, |conn| {
        let settings = app_settings::get(conn)?;
        if !settings.daily_summary_enabled {
            return Ok(None);
        }
        let Some(at) = timing::parse_day_time(&settings.daily_summary_time) else {
            return Ok(None);
        };
        let last = app_settings::summary_last_sent(conn)?;
        let Some(day) = timing::summary_due(&Local, now, at, last) else {
            return Ok(None);
        };
        app_settings::set_summary_last_sent(conn, day)?;
        let overview = today::overview(conn, &Local, now)?;
        Ok(Some(messages::daily_summary(&overview)))
    });
    match notice {
        Ok(Some(notice)) => notify::show(app, notice),
        Ok(None) => {}
        Err(error) => eprintln!("Daily summary failed: {error}"),
    }
}
