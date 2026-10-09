# Kairos — Task Breakdown

How to use: give the AI **one task ID at a time**. A task is done only when its acceptance criteria pass, tests pass, and you (Zack) have tried it in the running app. Tick `[x]` when done.

Legend: 🧱 setup · 🗄 data · 🎨 UI · ⚙️ logic · 🧪 tests · 🚀 release

---

## Phase 1 — Foundation
**Goal:** a usable personal planner you can live in for one week.

- [x] **P1-T01 🧱 Project scaffold** — Tauri 2 + React + TS + Vite + pnpm. Add Tailwind v4, shadcn/ui, Lucide, ESLint/Prettier, clippy/rustfmt, Vitest, GitHub Actions CI (lint + test on Windows & macOS).
  *Done when:* `pnpm tauri dev` opens a window titled "Kairos"; CI green.
- [x] **P1-T02 🎨 Design tokens & fonts** — `tokens.css` with all light/dark tokens from DESIGN_SYSTEM §3; Fraunces + Inter bundled locally; Tailwind mapped to tokens; theme provider (Light/Dark/System) with no flash on load.
  *Done when:* a `/dev/styleguide` screen shows colours, type scale, buttons in both themes.
- [x] **P1-T03 🎨 App shell** — sidebar (icon + label, collapsible), top bar (search placeholder, "+ Add task", theme toggle), routing for My Day, Calendar, Inbox, Settings.
  *Done when:* all nav works by mouse and keyboard; layout holds at 960 px width.
- [x] **P1-T04 🗄 Database & migrations** — rusqlite bundled, WAL, foreign keys, migration runner, tables `areas`, `items`, `checklist_items`, `reminders`, `settings`, `backup_log`, `items_fts`. Seed default areas.
  *Done when:* app creates `kairos.db` in app-data on first run; migration tests pass.
- [x] **P1-T05 ⚙️ Item service & commands** — create/update/delete(soft)/restore/complete/uncomplete/reschedule, list by range, `get_dashboard`. Type generation to TS.
  *Done when:* Rust unit tests cover CRUD + soft delete + reschedule_count increments.
- [x] **P1-T06 ⚙️ Status engine** — pure functions implementing PRD §6 status rules (TS + Rust where needed).
  *Done when:* unit tests cover all statuses incl. all-day, midnight, timezone and DST boundaries.
- [x] **P1-T07 🎨 Item editor side panel** — title, date, time, duration, all-day, area, priority, notes, checklist; friendly pill pickers; validation with Zod.
  *Done when:* create and edit work; Esc closes; unsaved-change guard.
- [x] **P1-T08 🎨 My Day dashboard** — greeting, summary line, Now/Today/Slipped/This week/Done sections, area filter, one-click complete with gold animation + Undo toast, empty state.
  *Done when:* matches PRD R2 acceptance criteria.
- [x] **P1-T09 🎨 Calendar: Week & Day views** — hour grid, now line, events/tasks blocks, all-day row, drag to move, drag edge to resize, click-drag to create.
  *Done when:* drag/resize persist; works with 500 items in a week without lag.
- [x] **P1-T10 🎨 Calendar: Month & Agenda views** — month grid with "+N more", agenda list grouped by day; Today button and `T` shortcut.
- [x] **P1-T11 ⚙️ Offline natural-language parser** — chrono-node + `#area` + `!priority` parsing, returns title + chips.
  *Done when:* 40+ test phrases pass ("tomorrow 3pm", "next Fri", "in 2 hours", "every Monday" flagged for Phase 2).
- [x] **P1-T12 🎨 Quick Capture** — in-app "+ Add" quick bar and global shortcut floating window; chips preview; Enter saves.
  *Done when:* capture from another app in < 5 s; window hides after save; main view updates.
- [x] **P1-T13 🎨 Trash** — list soft-deleted items, restore, empty Trash (confirm), auto-purge after 30 days.
- [x] **P1-T14 ⚙️ Automatic backups & restore** — Online Backup API, on close + every 24 h, retention 14 daily / 8 weekly, verification, optional user folder, Settings › Backups screen with list + Restore + "Back up now".
  *Done when:* E2E: create items → backup → delete DB items → restore → items back.
- [x] **P1-T15 ⚙️ Startup integrity check & recovery** — quick_check, auto-restore latest good backup, calm notice.
- [x] **P1-T16 🎨 Settings (basic)** — theme, text size, week start, default reminder time, backup folder.
- [x] **P1-T17 🧪 Phase 1 test pass** — E2E for create/complete/undo/reschedule/backup; manual check of the UI checklist on every screen. Results: `docs/qa/PHASE1_CHECKLIST.md`.

**🛑 Checkpoint:** use Kairos daily for one week. Log frustrations in a notes file → feed into Phase 2.

---

## Phase 2 — Smart layer
**Goal:** Kairos reaches you, forgives you, and teaches itself.

- [x] **P2-T01 ⚙️ Reminder scheduler** — Rust loop, multiple reminders per item, sleep/wake + clock-change handling, "while you were away" summary.
- [x] **P2-T02 ⚙️ Native notifications + actions** — Done / Snooze (10 min, 1 h, tomorrow) / Open.
- [x] **P2-T03 ⚙️ Tray / menu bar + autostart** — close-to-tray, tray menu (Open, Quick add, Today's next item, Quit), launch at login toggle.
- [x] **P2-T04 ⚙️ Daily summary notification** at chosen time.
- [x] **P2-T05 🎨 Missed-task ("slipped") flow** — morning card, per-item and bulk actions, "break into smaller steps" after 3 reschedules.
- [x] **P2-T06 ⚙️ Recurrence** — rrule storage, range expansion, exceptions, "this one / all future" editing, Repeat picker in plain language; NLP "every Monday".
- [x] **P2-T07 🎨 Time-blocking** — drag unscheduled/Inbox tasks onto the Day/Week grid.
- [x] **P2-T08 🎨 Onboarding** — 3-screen welcome (name, theme, areas), sample teaching tasks, skippable.
- [x] **P2-T09 🎨 Search & command palette** — `Ctrl/⌘+K`, FTS results grouped by status, commands (new task, go to date, switch theme).
- [x] **P2-T10 🎨 Area management** — add/rename/recolour/reorder/archive areas.
- [x] **P2-T11 🎨 Attachments & location** on items (stored in app-data, open with OS).
- [x] **P2-T12 ⚙️ Import/Export** — `.ics` import, JSON + `.ics` export.
- [x] **P2-T13 🧪 Accessibility pass** — keyboard audit, screen reader labels (NVDA + VoiceOver), automated contrast tests, text-size and reduce-motion checks. Results and the by-hand NVDA checklist: `docs/qa/ACCESSIBILITY.md`.
- [x] **P2-T14 🎨 Visual polish** — apply notes from reviewing Sunsama/Fantastical; micro-interactions; skeletons; consistent empty states.

**🛑 Checkpoint:** give a beta build to 3–5 people (including one non-technical person). Watch them use it without help.

---

## Phase 3 — Pro & AI
**Goal:** the features that make Kairos worth paying for.

- [x] **P3-T01 🗄🎨 Inbox** — text/image/voice entries, process into task. (Text and pictures done; voice notes come with P3-T14.)
- [x] **P3-T02 🗄🎨 Habits & streaks** — habit CRUD, daily ticks, streak, heatmap, gentle "streak paused" copy.
- [x] **P3-T03 🗄🎨 Goals → milestones → tasks** with progress.
- [x] **P3-T04 🗄🎨 Templates** — save selection as template, insert relative to a date.
- [x] **P3-T05 🎨 Focus mode** — timer, full-screen calm view, notification mute, focus logs.
- [x] **P3-T06 🎨 Weekly review** — done/slipped, time per area, balance insights. *(Review day setting, Sunday by default; My Day shows an invitation on that day.)*
- [x] **P3-T07 🎨 Feedback loop** — "Suggest a feature" button, wishlist board, behaviour-based suggestions. *(Behaviour-based: the R6 "keeps moving" nudge plus a suggestion link on the weekly review; more can come later.)*
- [ ] **P3-T07a 📝 Decide the feedback email** — "Email to the developer" uses the developer's personal address for now (`services/feedback.rs` `DEVELOPER_EMAIL`). Decide the final address, or make it a setting (admin or in the UI).
- [x] **P3-T08 ⚙️ AI foundation** — `AiProvider` trait, Gemini provider, keychain key storage, consent screen, Settings › Smart features, error handling and timeouts.
- [ ] **P3-T09 ⚙️🎨 A1 Screenshot/image → task** (drag, paste, pick) with confirm form.
- [x] **P3-T10 ⚙️ A2 Smart natural language** fallback when offline parser is unsure.
- [ ] **P3-T11 ⚙️🎨 A3 Plan my day/week** with accept-all/some/none.
- [ ] **P3-T12 ⚙️🎨 A4 Overflow rescheduling suggestions.**
- [ ] **P3-T13 ⚙️ A5 Energy-aware suggestions** from local completion patterns.
- [ ] **P3-T14 ⚙️ Voice capture** (OS speech-to-text) in Quick Capture.

---

## Phase 4 — Polish & launch
**Goal:** a signed, sellable product.

- [ ] **P4-T01 🧪 Performance pass** — 50k-item test DB, startup/view budgets, list virtualisation, bundle size.
- [ ] **P4-T02 🧪 Security review** (workflow step 13) — capabilities, CSP, keychain, dependency audit (`pnpm audit`, `cargo audit`).
- [ ] **P4-T03 🧪 Code review pass** (step 14) — dead code, consistency, docs updated.
- [ ] **P4-T04 ⚙️ Licensing** — free vs Pro gating, offline licence key verification, payment provider integration.
- [ ] **P4-T05 🚀 Auto-update** — signed updates via `tauri-plugin-updater`, toggle in settings.
- [ ] **P4-T06 🚀 Opt-in crash reporting** (step 18) — anonymised, off by default.
- [ ] **P4-T07 🚀 Signed installers** (step 17) — Windows (MSI/NSIS, code-signed) and macOS (DMG, Developer ID, notarised) via GitHub Actions.
- [ ] **P4-T07a 📝 TODO (decide later): how to publish on Windows** — Microsoft Store (Microsoft signs it; no SmartScreen warning) vs Azure Trusted Signing (~$10/month, some countries only) vs a bought certificate (~$100–400/year), or stay unsigned. Beta 0.2.0 ships unsigned (decision 2026-10-09).
- [ ] **P4-T08 🎨 Logo, app icons, tray icons** in all required sizes.
- [ ] **P4-T09 🚀 Landing page** — tagline, screenshots in both themes, privacy promise, download + buy.
- [ ] **P4-T10 🧪 QA testing** (step 16) on clean Windows 10, Windows 11, macOS Intel, macOS Apple Silicon.
- [ ] **P4-T11 🚀 Launch** — Product Hunt, Reddit, productivity communities; collect feedback into the wishlist.

---

## Before Phase 1 starts (Zack's to-dos)
- [x] Decide which drive and folder to build in. The AI will ask you this before creating anything. → `I:\Claude Projects\Kairos`
- [x] Install: Node.js LTS, pnpm, Rust (rustup), Tauri prerequisites for your OS (WebView2 on Windows; Xcode CLT on macOS) → tools in `I:\DevTools`
- [x] Create a GitHub repo `kairos` and add these docs under `/docs`; copy `PROJECT_RULES.md` → `CLAUDE.md`
- [ ] (Phase 3) Get a free Gemini API key from Google AI Studio
- [ ] (Phase 4) Apple Developer account and Windows code-signing certificate
