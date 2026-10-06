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

All three are open-source (SIL OFL). Ship the `.woff2` files inside the app; never load from Google Fonts at runtime.
