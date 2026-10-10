# Security review (P4-T02)

Reviewed 2026-10-10 against ARCHITECTURE §8 and PROJECT_RULES (local-first, no secrets in code/DB/logs/exports, the frontend never touches SQL or the network).

## Fixed in this review

| Finding | Fix |
|---------|-----|
| **The content security policy was off** (`"csp": null`), unlike ARCHITECTURE §8. | A strict CSP for the bundled app: `default-src 'self'`, scripts only from the app, no `eval`, `connect-src` only Tauri's IPC (and `data:` for picture previews), no frames, objects, forms or base changes. The dev server (`devCsp`) stays open for hot reload. The E2E suite runs against the CSP build. |
| **Opening a program attachment would run it.** `open_attachment` handed any file to the OS, so an attached `.exe`, `.bat`, `.ps1`, `.lnk` or similar would start. | `services/attachments.rs::check_openable` refuses about 25 program and script types with a friendly message ("Use Show in folder instead"). Showing the file in its folder still works. |

## Checked: as designed

- **Capabilities.**
  - The main window has `core:default` plus file open and save dialogs.
  - The Quick Capture window has `core:default` plus `window:allow-hide`.
  - Plugins with outside effects (opener, notifications, autostart, global shortcut) are used only from Rust; the frontend has no permission for them.
  - Follow-up: Kairos's own commands are callable from both windows (Tauri's default). An app permission manifest could limit the capture window to what it needs.
- **Network.** Two places make requests. `ai/gemini.rs` calls `generativelanguage.googleapis.com`, and only after consent with a saved key. The updater (P4-T05) asks GitHub for `latest.json` once a day; this can be turned off, and it is off in development builds. It installs only signed updates, and only when the user asks. The other outward actions open fixed addresses through the OS:
  - Google AI Studio's key page;
  - Windows privacy pages (`ms-settings:`);
  - a `mailto:` link built from the user's own wishlist.

  There is no telemetry or crash reporting.
- **What AI requests contain.**
  - A2: the typed sentence plus the local date and time.
  - A1: the shrunk picture.
  - A3/A4: task titles, busy times' titles and times, working hours, and (A5) the best-hours range.

  Never notes or attachments. Tests check this for A2 and A3.
- **Secrets.**
  - The Gemini key lives only in the OS keychain (`ai/secrets.rs`; development builds use a separate entry).
  - It is sent only in the `x-goog-api-key` header, never in a URL, so request errors can't reveal it.
  - It is not part of settings, exports, backups or logs. Error messages are reduced to short reasons, with no response bodies.
- **SQL.** All queries are parameterised. The only `format!` in SQL inserts fixed column lists, and search terms are bound parameters (`MATCH :q`).
- **Files.**
  - Attachments are copied into the app folder under generated names. `file_of` accepts only a bare file name, so there's no path traversal.
  - Export and import paths come from the OS file dialogs.
  - Voice capture keeps only text; no audio is saved.
- **Logs.** `eprintln!` reports only failures with error text; no user content or keys.

## Dependency audit

| Check | Result |
|-------|--------|
| `pnpm audit` | No known vulnerabilities. |
| `cargo audit` (RustSec, 563 crates) | No known vulnerabilities. 2 warnings, both in **Linux-only** GTK libraries that Tauri uses on Linux (`glib` 0.18, unsound iterator, RUSTSEC-2024-0429; `proc-macro-error`, unmaintained, RUSTSEC-2024-0370). Neither is built for Windows or macOS; they go away when Tauri moves to GTK 4. |

Re-run both before every release (SETUP §4).
