# Kairos — Tech Stack

Goal: **modern, lightweight, fast, offline, small installer.** Every choice below serves that.

> **Version note:** use the latest *stable* release of each tool at project setup and pin exact versions in `package.json` / `Cargo.lock`. Do not use beta/RC releases.

## Summary

| Layer | Choice | Why |
|-------|--------|-----|
| Desktop shell | **Tauri 2** | Uses the OS's built-in web view instead of bundling Chromium → installers of a few MB (Electron: 100+ MB), low RAM, Rust backend, strong permission model, mobile support later. |
| Backend language | **Rust** (inside Tauri) | Fast, memory-safe; owns the database, backups, notifications, file system. |
| Frontend framework | **React 19 + TypeScript** (strict mode) | Industry standard, huge ecosystem, best-supported by AI coding tools. |
| Build tool | **Vite** | Instant dev server, small production bundles; official Tauri template. |
| Styling | **Tailwind CSS v4** + CSS variables for theme tokens | Fast to build, consistent, tiny output; tokens make light/dark trivial. |
| UI primitives | **shadcn/ui** (built on **Radix UI**) | Accessible components (keyboard, screen reader) copied into our repo — fully restylable to the Kairos brand. |
| Icons | **Lucide** | Clean, consistent line icons; tree-shakable. |
| Animation | **Motion** (formerly Framer Motion) | Smooth micro-interactions; respects reduce-motion. |
| Database | **SQLite** (via `rusqlite`, bundled) | One file on disk, zero setup, offline, extremely reliable, ideal for one user. |
| Migrations | `rusqlite_migration` | Versioned schema changes, run automatically on startup. |
| Client data layer | **TanStack Query** | Caching and refetching of data from Rust commands; optimistic updates. |
| UI state | **Zustand** | Tiny store for UI-only state (theme, open panels, selected date). |
| Routing | **TanStack Router** (or React Router) | Type-safe screens: Dashboard, Calendar, Inbox, Goals, Habits, Settings. |
| Forms & validation | **React Hook Form + Zod** | Fast forms; same Zod schemas validate data at the boundary. |
| Calendar grid | Custom-built Day/Week/Month views on top of **date-fns** | Full control over the premium look and drag-and-drop; avoids heavy calendar libraries. Drag & drop via **dnd-kit**. |
| Dates & recurrence | **date-fns** + **rrule** (RFC 5545) | Reliable date maths; standard recurrence rules compatible with `.ics`. |
| Natural language (offline) | **chrono-node** + small custom parser for `#area` and `!priority` | Parses "tomorrow 3pm" locally, no internet. |
| i18n | **i18next / react-i18next** | All strings in JSON from day one. |
| Notifications | `tauri-plugin-notification` | Native OS notifications. |
| Global shortcut | `tauri-plugin-global-shortcut` | Quick Capture from anywhere. |
| Autostart | `tauri-plugin-autostart` | Launch at login for reminders. |
| Tray / menu bar | Tauri tray API | Keeps reminders running when window closed. |
| Secrets | `keyring` crate (OS keychain / Credential Manager) | Stores the Gemini API key securely. |
| Auto-update | `tauri-plugin-updater` (Phase 4) | Signed updates. |
| AI | **Google Gemini API** (free tier, user's own key), called from Rust via HTTPS | Vision + text; free tier sufficient for personal use. Wrapped behind an `AiProvider` trait so a local model can be swapped in later. |
| Testing | **Vitest** + **React Testing Library** (frontend), `cargo test` (Rust), **Playwright** or WebdriverIO for end-to-end | Fast unit tests and real flow tests. |
| Lint/format | **ESLint** + **Prettier**; `clippy` + `rustfmt` | Consistent code quality. |
| Package manager | **pnpm** | Fast, disk-efficient. |
| CI | **GitHub Actions** with `tauri-action` | Builds Windows + macOS installers on every release tag. |

## Additions & pinned versions (kept up to date)

Every library, crate or tool added after the original plan is listed here **in the same PR that adds it** (PROJECT_RULES → "Dependencies"). Exact versions live in `package.json`, `pnpm-lock.yaml` and `src-tauri/Cargo.lock`; this table explains *why*.

### Frontend (npm)
| Package | Version | Added in | Why |
|---------|---------|----------|-----|
| `@fontsource-variable/inter`, `@fontsource-variable/fraunces` | 5.3.0 | P1-T02 | Ship the official Inter and Fraunces `.woff2` files inside the app (Vite bundles them). No runtime font downloads. Fraunces uses the `opsz.css` (weight + optical-size) variant. |
| `i18next`, `react-i18next` | 26.4 / 17.0 | P1-T02 | Planned above; set up early because every visible string must go through `t()`. Strings live in `src/i18n/locales/en.json`. |
| `zustand` | 5.0 | P1-T02 | Planned above; theme preference and sidebar state. |
| `@tanstack/react-router` | 1.170 | P1-T03 | Chosen over React Router (approved). Code-based routes with **hash history** (desktop app, no URL bar). |
| `@radix-ui/react-tooltip` | 1.2 | P1-T03 | The Radix primitive behind shadcn/ui's Tooltip; required for icon-only buttons (DESIGN_SYSTEM §2). |
| `class-variance-authority`, `clsx`, `tailwind-merge` | 0.7 / 2.1 / 3.7 | P1-T01 | Standard shadcn/ui helpers for component variants and the `cn()` class merger. |
| `@tanstack/react-query` | 5.104 | P1-T07 | Planned above. One `QueryClient` (`src/app/queryClient.ts`); every item query key starts with `"items"` so a single invalidation refreshes all views. |
| `react-hook-form`, `zod` | 7.89 / 4.6 | P1-T07 | Planned above. Zod schema + a small hand-written resolver in `src/features/items/itemForm.ts` (no `@hookform/resolvers` package needed). |
| `motion` | 14.0 | P1-T08 | Planned above (Motion, formerly Framer Motion): completion animation, list enter/exit. Respects reduced motion. |
| `@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-toast` | 1.2 / 1.2 / 1.2 | P1-T07/T08 | Radix primitives behind shadcn/ui's Sheet (side panel), Popover (pill pickers) and Toast (Undo). Same family as the approved tooltip. |
| `chrono-node` | 2.10 | P1-T11 | Planned above: offline English date/time parsing for Quick Capture (`src/lib/nlp/parseCapture.ts`), with our own `#area`, `!priority` and "every …" (flagged for Phase 2) handling. |
| `@dnd-kit/core` | 6.3 | P1-T09 | Planned above (dnd-kit): drag to move/resize calendar items, with keyboard dragging and translated screen-reader announcements. |
| Native `<input type="date">` / `type="time"` | — | P1-T07 | Date and time inside the pill pickers use the WebView's built-in inputs instead of a date-picker library (accessible, zero size). A custom premium picker can replace them in P2-T14 polish. |
| `date-fns` | 4.4 | P1-T06 | Planned above; installed for the status engine's local-day maths (`src/lib/dates/dayContext.ts`). Uses the device's time zone; no extra time-zone library. Tests simulate other zones by setting `process.env.TZ`. |

### Frontend tooling (npm, dev only)
| Package | Version | Why |
|---------|---------|-----|
| `typescript` | **6.0.3 (pinned below 6.1)** | TypeScript 7 is out, but `typescript-eslint` only supports `<6.1`. Upgrade both together once it does. |
| `vite` / `vitest` / `jsdom` | 8.3 / 5.0 / 30.1 | Build tool and unit tests. Vitest replaces CSS imports with empty strings, so tests that inspect CSS read the file from disk. |
| `@testing-library/react`, `jest-dom`, `user-event` | 16.3 / 7.0 / 14.6 | React Testing Library. |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `eslint-config-prettier`, `globals` | 10.12 / 8.71 / 7.1 / 0.5 / 10.1 / 17.13 | Linting (strict TS rules, no `any`). |
| `prettier` | 3.9 | Formatting (`printWidth` 100, LF line endings). |
| `webdriverio`, `@wdio/cli`, `@wdio/local-runner`, `@wdio/mocha-framework`, `@wdio/spec-reporter`, `@wdio/globals` | 10.0 | Planned above (WebdriverIO E2E, P1-T17). Drives the real app through **tauri-driver** + **msedgedriver** (tools, see SETUP.md). Windows only for now (Tauri's WebDriver doesn't support macOS WKWebView). pnpm `allowBuilds` blocks the driver packages' own downloads. |
| `axe-core` | 4.14 | Accessibility checks (P2-T13), dev/test only, never shipped: injected into the real app by `tests/e2e/specs/accessibility.e2e.ts` and run on every screen in unit tests (`src/test/a11y.test.tsx`). Approved 2026-10-09. (`@axe-core/webdriverio` was tried and dropped: it doesn't support WebdriverIO 10.) |
| `@types/node` | 26.6 | Types for `vite.config.ts` and test files only (`tsconfig.node.json`, `tsconfig.test.json`), never app code. |

### Backend (Rust crates)
| Crate | Version | Added in | Why |
|-------|---------|----------|-----|
| `rusqlite` | 0.40, features `bundled`, `backup` | P1-T04 | Planned above. `bundled` compiles SQLite into the app; `backup` enables the Online Backup API (pre-migration and scheduled backups). Must match the version `rusqlite_migration` uses (one SQLite in the binary). |
| `rusqlite_migration` | 2.6 | P1-T04 | Planned above. Migrations are numbered `.sql` files in `src-tauri/src/db/migrations/`. |
| `uuid` (feature `v7`) | 1.27 | P1-T04 | UUID v7 IDs (ARCHITECTURE §4). Approved 2026-10-07. |
| `chrono` (features `clock`, `std`) | 0.4 | P1-T04 | UTC ISO-8601 timestamps. Approved 2026-10-07. |
| `thiserror` | 2.0 | P1-T04 | Defines `AppError`, returned by every command. Approved 2026-10-07. |
| `tauri-plugin-dialog` + `@tauri-apps/plugin-dialog` | 2 | P1-T14 | Official Tauri plugin: the system "Choose folder…" window for the extra backup folder (PRD R5). Approved 2026-10-08. Permission: `dialog:allow-open` (main window only). Will also serve import/export and attachments. |
| `tauri-plugin-global-shortcut` (desktop only) | 2.4 | P1-T12 | Planned above: Ctrl/⌘+Shift+Space opens the Quick Capture window from any app. If another app owns the shortcut, Kairos starts anyway and logs it. |
| `tauri-plugin-notification` (macOS/Linux only) | 2.5 | P2-T02 | Planned above: native notifications. On desktop its stable release ignores action buttons, so on Windows Kairos uses `tauri-winrt-notification` instead; on macOS reminders are plain notifications for now (buttons later). |
| `tauri-winrt-notification` (Windows only) | 0.8 | P2-T02 | By the Tauri team (the library the notification plugin uses inside). Windows toasts with **Done / Snooze 10 min / Snooze 1 hour / Tomorrow** buttons and click handling (PRD R3). Approved 2026-10-08. Development builds borrow PowerShell's app id (Windows needs an installed app id); installed builds use `com.kairos.app`. Clicks are reported while the toast is on screen, not from the Action Center. |
| `tauri-plugin-autostart` (desktop) | 2.7 | P2-T03 | Planned above: "Open Kairos when you sign in" (default on), starting hidden in the tray (`--hidden`). Debug builds never register themselves. |
| Tauri `tray-icon` feature | 2 | P2-T03 | Planned above (Tauri tray API): tray menu, close-to-tray. |
| `rrule` | 0.14 | P2-T06 | Planned above ("rrule"): RFC 5545 repeat rules on the Rust side (calendar expansion, reminders, My Day). Pure Rust, MIT/Apache. Approved 2026-10-09 over a hand-written parser so `.ics` import (P2-T12) works later. Pulls in `chrono-tz` (time-zone database, roughly +1 MB); Kairos itself expands in local wall-clock time and doesn't use time-zone names. |
| `tauri-plugin-opener` (desktop) | 2.7 | P2-T11 | Official Tauri plugin: opens an attachment with the system's usual app and "Show in folder". Approved 2026-10-09. Called only from Rust commands, which only open files inside Kairos' attachments folder, so the frontend gets no opener permission. |
| `icalendar` (feature `parser` only) | 0.17 | P2-T12 | Reads `.ics` files from other calendar apps (folded lines, escaping, parameters). Approved 2026-10-09. Export is written by Kairos itself (`services/ics.rs`). |
| `chrono-tz` | 0.10 | P2-T12 | Converts imported times with a named zone (`TZID=Europe/London`). Same version `rrule` already brings in, so one copy. Approved 2026-10-09. |
| `reqwest` (`json`, `native-tls`; default features off) | 0.13 | P3-T08 | HTTPS to the Gemini API from Rust (the plan above says "called from Rust via HTTPS" without naming a client). Async, so smart features never block the window; 20 s timeout. `native-tls` uses the OS TLS (SChannel on Windows, Security.framework on macOS): no OpenSSL or extra build tools on Windows (reqwest 0.13's rustls option needs aws-lc). Approved 2026-10-09. |
| `keyring` (default `v1` API) | 4.2 | P3-T08 | Planned above ("Secrets"): the Gemini key in Windows Credential Manager / macOS Keychain. Entry service `Kairos` (`Kairos (dev)` in development builds), account `gemini-api-key`. |
| `ts-rs` (**dev-dependency only**) | 12.0 | P1-T05 | Generates TypeScript types in `src/types/` from Rust structs when `cargo test` runs. Chosen over specta/tauri-specta because the Tauri 2 version of tauri-specta is only a release candidate (`2.0.0-rc`), which this doc forbids. Approved 2026-10-07. Config: `.cargo/config.toml` (`TS_RS_EXPORT_DIR=src/types`, `TS_RS_LARGE_INT=number`). Not compiled into the shipped app. |

## Decisions explained

### Tauri vs Electron → Tauri
Electron ships an entire Chromium browser with every app. Tauri uses the web view already on the OS (WebView2 on Windows, WKWebView on macOS). Result: a Kairos installer around 5–15 MB instead of 100+ MB, and a fraction of the memory. Trade-off: small rendering differences between WebView2 and WebKit — test on both platforms every phase.

### SQLite vs PostgreSQL → SQLite
PostgreSQL is a server built for many users over a network. Kairos has one user on one machine, offline. SQLite is a single file, needs no running service, and is among the most reliable software ever written. Future sync can be layered on top (see ARCHITECTURE §9).

### Why the database lives in Rust, not the frontend
Keeping all reads/writes in Rust commands means one place enforces validation, transactions, backups, and integrity. The frontend never touches SQL directly.

### Why the user's own Gemini key
Consumer chat apps (free ChatGPT/Claude/Gemini web) have no permitted programmatic access; automating them breaks terms of service and breaks constantly. The Gemini API free tier is official, free for personal volumes, and the user controls it. If no key is set, AI features are simply hidden behind a friendly "Turn on smart features" card.

## Fonts (bundled — no internet needed)
- **Fraunces** (variable serif) — display & headings
- **Inter** (variable sans) — UI and body
- **JetBrains Mono** — numbers in timers/time grids (optional)

All three are open-source (SIL OFL). Ship the `.woff2` files inside the app; never load from Google Fonts at runtime. Fraunces and Inter are bundled via the Fontsource packages listed above; JetBrains Mono is not used yet (numbers use Inter with `tabular-nums`).
