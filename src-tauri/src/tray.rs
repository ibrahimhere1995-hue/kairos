//! Tray / menu bar icon (PRD R3, P2-T03): Kairos keeps running there so reminders arrive
//! with the window closed. Menu: Open, Quick add, today's next item, Quit.

use std::sync::Mutex;

use chrono::{Local, Utc};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Emitter, Manager, Wry};

use crate::commands::with_conn;
use crate::db::Db;
use crate::i18n::t;
use crate::notify::OPEN_ITEM;
use crate::scheduler::messages::tray_next;
use crate::services::today;

/// The tray mark, generated from `icons/source/tray-icon.svg` (P4-T08).
const TRAY_ICON: &[u8] = include_bytes!("../icons/tray@2x.png");
use crate::{capture, window};

const OPEN: &str = "open";
const QUICK_ADD: &str = "quick-add";
const NEXT: &str = "next";
const QUIT: &str = "quit";

/// The "next item" menu entry and the item it points to, refreshed by the scheduler.
pub struct TrayNext {
    entry: MenuItem<Wry>,
    item_id: Mutex<Option<String>>,
}

pub fn create(app: &App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, OPEN, t("tray.open", &[]), true, None::<&str>)?;
    let quick = MenuItem::with_id(app, QUICK_ADD, t("tray.quickAdd", &[]), true, None::<&str>)?;
    let next = MenuItem::with_id(app, NEXT, t("tray.nothingNext", &[]), false, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT, t("tray.quit", &[]), true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &quick,
            &PredefinedMenuItem::separator(app)?,
            &next,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id("kairos")
        .tooltip(t("tray.tooltip", &[]))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            OPEN => window::show_main(app),
            QUICK_ADD => capture::toggle(app),
            NEXT => open_next(app),
            // Quitting runs the normal exit path, including the backup on close.
            QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window::show_main(tray.app_handle());
            }
        });
    // The one-colour mark (DESIGN_SYSTEM §1: must read at 16 px); the app icon if it can't load.
    match tauri::image::Image::from_bytes(TRAY_ICON) {
        Ok(icon) => builder = builder.icon(icon),
        Err(_) => {
            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }
        }
    }
    builder.build(app)?;

    app.manage(TrayNext {
        entry: next,
        item_id: Mutex::new(None),
    });
    refresh(app.handle());
    Ok(())
}

fn open_next(app: &AppHandle) {
    let id = app
        .try_state::<TrayNext>()
        .and_then(|state| state.item_id.lock().ok().and_then(|id| id.clone()));
    if let Some(id) = id {
        window::show_main(app);
        let _ = app.emit_to(window::MAIN_WINDOW, OPEN_ITEM, id);
    }
}

/// Updates the "next item" line. Cheap; called by the scheduler every tick.
pub fn refresh(app: &AppHandle) {
    let (Some(state), Some(db)) = (app.try_state::<TrayNext>(), app.try_state::<Db>()) else {
        return;
    };
    let Ok(overview) = with_conn(&db, |conn| today::overview(conn, &Local, Utc::now())) else {
        return;
    };
    let label = tray_next(&Local, overview.next.as_ref());
    let _ = state.entry.set_text(label);
    let _ = state.entry.set_enabled(overview.next.is_some());
    if let Ok(mut id) = state.item_id.lock() {
        *id = overview.next.map(|n| n.id);
    }
}
