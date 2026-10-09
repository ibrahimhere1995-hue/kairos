//! Native notifications (PRD R3). On Windows: toasts with Done / Snooze / Open, via
//! `tauri-winrt-notification`. Elsewhere: plain notifications from the Tauri plugin
//! (buttons on macOS come later).

use tauri::{AppHandle, Emitter, Manager};

use crate::commands::{ITEMS_CHANGED, with_conn};
use crate::db::Db;
use crate::scheduler::messages::{Notice, ReminderRef, Target};
use crate::scheduler::timing::Snooze;
use crate::services::{items, reminders};
use crate::window;

/// Sent to the main window to open an item's editor. Payload: the item id.
pub const OPEN_ITEM: &str = "app:open-item";
/// Sent to the main window to go to a screen. Payload: a route path, e.g. "/".
pub const NAVIGATE: &str = "app:navigate";

const ACTION_DONE: &str = "done";
const ACTION_SNOOZE: &str = "snooze:";

/// Shows a notification. Failures are logged, never fatal: the in-app views still show
/// everything that is due.
pub fn show(app: &AppHandle, notice: Notice) {
    // E2E runs (WebDriver) use throwaway data: never pop real notifications on the desktop.
    if cfg!(debug_assertions) && std::env::var_os("TAURI_WEBVIEW_AUTOMATION").is_some() {
        return;
    }

    #[cfg(windows)]
    windows_toast::show(app, notice);

    #[cfg(not(windows))]
    {
        use tauri_plugin_notification::NotificationExt;
        if let Err(error) = app
            .notification()
            .builder()
            .title(&notice.title)
            .body(&notice.body)
            .show()
        {
            eprintln!("Notification failed: {error}");
        }
    }
}

/// A click on the notification (`action` None) or one of its buttons.
pub fn handle_action(
    app: &AppHandle,
    action: Option<&str>,
    target: &Target,
    reminder: Option<&ReminderRef>,
) {
    let Some(db) = app.try_state::<Db>() else {
        return;
    };
    match (action, reminder) {
        (Some(ACTION_DONE), Some(r)) => {
            if with_conn(&db, |conn| items::complete(conn, &r.item_id)).is_ok() {
                let _ = app.emit(ITEMS_CHANGED, ());
            }
        }
        (Some(action), Some(r)) if action.starts_with(ACTION_SNOOZE) => {
            let choice =
                Snooze::parse(&action[ACTION_SNOOZE.len()..]).unwrap_or(Snooze::TenMinutes);
            let result = with_conn(&db, |conn| {
                let clock = reminders::Clock::current(conn)?;
                reminders::snooze(conn, &r.reminder_id, choice, &clock)
            });
            if let Err(error) = result {
                eprintln!("Snooze failed: {error}");
            }
        }
        _ => open_target(app, target),
    }
}

fn open_target(app: &AppHandle, target: &Target) {
    window::show_main(app);
    // Best effort: the window still opens even if the event is missed.
    let _ = match target {
        Target::Item(id) => app.emit_to(window::MAIN_WINDOW, OPEN_ITEM, id),
        Target::MyDay => app.emit_to(window::MAIN_WINDOW, NAVIGATE, "/"),
    };
}

#[cfg(windows)]
mod windows_toast {
    use tauri::AppHandle;
    use tauri_winrt_notification::{Scenario, Toast};

    use super::{ACTION_DONE, ACTION_SNOOZE, handle_action};
    use crate::i18n::t;
    use crate::scheduler::messages::Notice;
    use crate::scheduler::timing::Snooze;

    /// Development builds aren't installed, so Windows doesn't know Kairos' app id yet;
    /// toasts then borrow PowerShell's (the Tauri plugin does the same). Installed builds use
    /// the bundle identifier, which the installer registers.
    fn app_id(app: &AppHandle) -> String {
        if cfg!(debug_assertions) {
            Toast::POWERSHELL_APP_ID.to_owned()
        } else {
            app.config().identifier.clone()
        }
    }

    pub fn show(app: &AppHandle, notice: Notice) {
        let mut toast = Toast::new(&app_id(app))
            .title(&notice.title)
            .text1(&notice.body);
        if notice.reminder.is_some() {
            let snooze = |choice: Snooze| format!("{ACTION_SNOOZE}{}", choice.as_str());
            toast = toast
                // Reminder toasts stay on screen until you act on them.
                .scenario(Scenario::Reminder)
                .add_button(&t("notifications.done", &[]), ACTION_DONE)
                .add_button(
                    &t("notifications.snooze10", &[]),
                    &snooze(Snooze::TenMinutes),
                )
                .add_button(&t("notifications.snooze1h", &[]), &snooze(Snooze::OneHour))
                .add_button(
                    &t("notifications.snoozeTomorrow", &[]),
                    &snooze(Snooze::Tomorrow),
                );
        }
        let handle = app.clone();
        let Notice {
            target, reminder, ..
        } = notice;
        toast = toast.on_activated(move |action| {
            handle_action(&handle, action.as_deref(), &target, reminder.as_ref());
            Ok(())
        });
        if let Err(error) = toast.show() {
            eprintln!("Notification failed: {error}");
        }
    }
}
