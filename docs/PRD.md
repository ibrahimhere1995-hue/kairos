# Kairos — Product Requirements Document

**Version:** 1.0 · **Owner:** Zack · **Status:** Approved for build

---

## 1. Problem statement

Busy people juggle work deadlines, meetings, learning goals, and home responsibilities across scattered tools: a work calendar, a to-do app, sticky notes, chat messages, and memory. Things slip, the day feels reactive, and nobody can see at a glance what matters *now*. Existing planners either push data to the cloud (privacy concerns, subscriptions), overwhelm new users with complexity, or lock their smart features behind expensive paid tiers.

Kairos solves this with one calm, local, premium planner that sorts everything into **ongoing / upcoming / missed / done**, groups it by **life area**, and tells the user — on opening — exactly what their day looks like.

## 2. Product principles

1. **Your data stays with you.** Everything is stored locally. Nothing leaves the machine unless the user explicitly uses an online feature (AI) or chooses a backup location.
2. **Zero learning curve.** Anyone — regardless of tech skill or literacy level — can use Kairos without a tutorial. Simple does not mean cheap: it must look and feel premium.
3. **Caring, never guilt-inducing.** Missed tasks are handled gently with options, not red warnings and nagging.
4. **Never lose data.** Automatic backups and safe recovery are a core feature, not an afterthought.
5. **Fast and light.** The app opens in under 2 seconds and the installer is small.

## 3. Users

### Lead user (design and launch target)
**The busy multi-hat professional.** Has a job (employee or business owner), is learning something on the side, and runs a home. Their calendar mixes meetings, deadlines, courses, school runs, bills, and gym. They want one place to see everything and feel in control.

### Also welcome (served, not designed around)
Students, freelancers, homemakers, small business owners. The design must not exclude them: plain language, large clear actions, icons always paired with words.

### Personas
- **Priya, 34, project manager + MBA student + parent.** Lives in her calendar; drops tasks between work and home.
- **Omar, 41, small business owner.** Not very tech-savvy; uses WhatsApp screenshots as his "to-do list".
- **Lena, 22, final-year student + part-time job.** Wants habits, streaks, and exam planning; uses dark mode always.

## 4. Goals

| Goal | Measure | Target |
|------|---------|--------|
| Instant clarity | Time from app open to user seeing their day | < 2 s |
| Effortless capture | Time to add a task with Quick Capture | < 5 s, ≤ 2 interactions |
| Zero-training use | New user adds first task without help | 95% in usability tests |
| Reliability | Data loss incidents | 0 |
| Retention (post-launch) | Users active 4 weeks after install | ≥ 40% |

## 5. Non-goals (v1)

- **Team / shared calendars.** Kairos is personal. Collaboration adds servers and accounts, which conflicts with local-first.
- **Cloud sync between devices.** Deferred to a future phase; the architecture must allow it (see ARCHITECTURE §9).
- **Mobile apps.** Phase 5+; same codebase later via Tauri mobile.
- **Two-way sync with Google/Outlook calendars.** v1 supports one-way `.ics` import only.
- **User accounts / login.** No accounts in v1. The app works the moment it is installed.

## 6. Core concepts

| Concept | Definition |
|---------|-----------|
| **Item** | Anything scheduled: a *task* (something to do) or an *event* (something that happens at a time, e.g. a meeting). |
| **Life area** | Category tag: Work, Home, Personal, Learning, Health (user can add/rename/recolour). |
| **Status** | Derived automatically: **Ongoing** (happening right now), **Due today** (still to do today), **Upcoming** (after today), **Missed** (a task whose moment passed, shown as "Slipped"), **Past** (an event that is over), **Done** (completed). User can also mark *Skipped*. |
| **Priority** | High, Medium, Low, None. |
| **Inbox** | Holding area for unprocessed captures (quick notes, screenshots, voice notes) without a date yet. |
| **Goal** | Long-term outcome broken into milestones, which contain tasks. |
| **Habit** | A repeating behaviour tracked by streak. |

### Status rules (exact)
Implemented in `src/lib/status/status.ts` (P1-T06). "Today" always means the user's **local** calendar day; on daylight-saving days it lasts 23 or 25 hours. Checked in this order:

1. Completed → `done` (regardless of time; beats skipped).
2. Skipped → `skipped`.
3. **Timed** item (has a start time):
   - start is later today → `dueToday`; start is tomorrow or later → `upcoming`.
   - start ≤ now < end (events, or tasks with a time window) → `ongoing`.
   - otherwise its time has passed: task → `missed` (even if it is still today; a passed time is never "Now"), event → `past`.
4. **Date-only** item: due today → `dueToday`; due after today → `upcoming`; due before today: task → `missed`, event → `past`.
5. No date → lives in **Inbox** (status `unscheduled`).

**Only tasks can be missed.** An event whose time has passed is `past`: shown muted, never "Slipped", never in the missed-items card. *(Decision 2026-10-07.)*

**My Day placement** *(decision 2026-10-07)*: **Now** shows `ongoing` items only (events in progress, timed tasks inside their window). `dueToday` items (date-only tasks due today, anything later today) appear in **Today**.

**Multi-day all-day events** (e.g. a 3-day trip) are **not in Phase 1**. They will be added later with a new migration (an end date for all-day items). *(Decision 2026-10-07.)*

## 7. Requirements

Priority key: **P0** = must ship in v1. **P1** = should ship in v1. **P2** = future, but design for it.

### 7.1 Mandatory core (P0)

#### R1 — Calendar with tasks and events
Views: Day, Week, Month, Agenda (list). Items show life-area colour, status, and priority.
- [ ] User can create, edit, duplicate, delete (to Trash) tasks and events.
- [ ] Fields: title (required), notes, date, start time, end time / duration, all-day flag, life area, priority, recurrence, reminders, checklist (sub-steps), location, attachments.
- [ ] Drag an item to another day/time to reschedule; drag edge to resize duration (Day/Week views).
- [ ] Today is always one click away ("Today" button + keyboard `T`).
- [ ] Deleted items go to Trash and can be restored for 30 days.

#### R2 — Smart dashboard ("My Day")
The home screen on open.
- [ ] Greeting with date and a one-line summary ("4 tasks today, 2 meetings, 1 missed from yesterday").
- [ ] Sections: **Now** (ongoing), **Today** (remaining today), **Missed**, **This week**, **Done today** (collapsible).
- [ ] Filter by life area with one click; balance strip showing time per area this week.
- [ ] Each item can be completed with one click on its checkbox, with a satisfying micro-animation and Undo toast.
- [ ] Empty state shows encouraging copy + a single "Add your first task" button (never a blank screen).

#### R3 — Reminders that reach you
- [ ] Native desktop notifications (Windows Action Center, macOS Notification Center).
- [ ] Default reminder: at start time for events, 9:00 AM on due day for date-only tasks (configurable).
- [ ] Multiple reminders per item (e.g., 1 day before, 15 min before).
- [ ] Notification actions: **Done**, **Snooze** (10 min / 1 h / tomorrow), **Open**.
- [ ] App keeps running in system tray / menu bar to deliver reminders when the window is closed; launches at login (user-toggleable, on by default).
- [ ] Daily summary notification at a user-chosen time (default 8:00 AM).

#### R4 — Quick Capture
- [ ] Global shortcut (default `Ctrl+Shift+Space` / `⌘⇧Space`) opens a small floating capture bar from anywhere, even when Kairos is minimised.
- [ ] Big "+ Add" button always visible in the app's top bar.
- [ ] Typing a title and pressing Enter saves it (to Today if no date given, configurable to Inbox).
- [ ] Natural-language parsing works offline: "Call bank tomorrow 3pm #home !high" → title "Call bank", tomorrow 15:00, area Home, priority High. Parsed parts are highlighted as chips before saving so the user can see and remove them.

#### R5 — Rock-solid local storage and backups
- [ ] All data in a single SQLite database in the OS app-data folder.
- [ ] Every write is transactional; a crash never corrupts data.
- [ ] Automatic backup: on every app close and every 24 hours, keep the last 14 daily + 8 weekly snapshots.
- [ ] User can choose an extra backup folder (e.g., a Google Drive / OneDrive / Dropbox synced folder or USB drive).
- [ ] One-click **Restore** from a list of backups with date, size, and item count; current data is backed up first before restoring.
- [ ] Export all data to JSON and to `.ics` (calendar); import `.ics`.

#### R6 — Missed-task flow (caring)
- [ ] On first open of the day, if there are missed items, show a gentle card: "3 things slipped by. Want to give them a new moment?" with per-item actions: **Today**, **Tomorrow**, **Pick a date**, **Done already**, **Let it go** (archive).
- [ ] Bulk action: "Move all to today".
- [ ] Missed items use a soft amber colour, never alarming red.
- [ ] If an item has been rescheduled 3+ times, offer: "This one keeps moving. Break it into smaller steps?" (opens checklist editor).

#### R7 — Onboarding and defaults
- [ ] First launch: 3 screens max — Welcome (name, tagline), choose theme (Light / Dark / Match system), pick life areas (pre-ticked defaults). Skippable.
- [ ] App is pre-populated with 3 sample tasks that teach by doing ("✓ Tick me when you've read this"), deletable in one click.
- [ ] Sensible defaults for every setting; no setting is required to start.

#### R8 — Themes
- [ ] Light, Dark, and Match System. Switching is instant, no restart.
- [ ] Follows `DESIGN_SYSTEM.md` exactly.

#### R9 — Search
- [ ] Global search (`Ctrl/⌘+K`) across titles, notes, checklist items, areas; results grouped by status, open item on Enter.
- [ ] Doubles as command palette ("new task", "go to week", "switch theme").

#### R10 — Accessibility and inclusivity
- [ ] Every icon has a visible text label (or tooltip in dense toolbars) and an accessible name.
- [ ] Full keyboard navigation; visible focus rings.
- [ ] WCAG 2.2 AA contrast in both themes.
- [ ] Text size setting: Small / Default / Large / Extra Large.
- [ ] Plain language everywhere: no jargon ("Remind me", not "Configure notification trigger").
- [ ] Respects OS "reduce motion".

### 7.2 Pro features (P1 — v1 if time allows, otherwise v1.x)

| ID | Feature | Behaviour |
|----|---------|-----------|
| R11 | Recurring items | Daily, weekdays, weekly on chosen days, monthly (date or "2nd Tuesday"), yearly, custom interval. Edit "this one" or "all future". |
| R12 | Time-blocking | Drag a task from the sidebar/Inbox onto the Day/Week grid to give it a time slot. |
| R13 | Habits & streaks | Create habit (daily / X times per week), tick each day, streak counter, calendar heatmap. Missing a day doesn't shame: "Streak paused — start again today." |
| R14 | Goals → milestones → tasks | Goal page with progress bar computed from completed tasks; link tasks to milestones. |
| R15 | Templates | Save any set of tasks as a template ("Monday kickoff", "Monthly bills") and insert with dates relative to a chosen day. |
| R16 | Focus mode | Pick one task, full-screen calm view with timer (25/5 Pomodoro or custom), mute Kairos notifications, log focused time. |
| R17 | Weekly review | Every Sunday (configurable): what got done, what slipped, time per life area, balance insight ("Health got 0 hours this week"). |
| R18 | Inbox | Unified holding area for quick notes, pasted screenshots, and voice notes; process each into a task with one click. |
| R19 | Feedback loop | "Suggest a feature" button (stores locally, optional email/export to developer); personal wishlist board; behaviour-based suggestions (see R6). |
| R20 | Voice capture | Hold-to-speak in Quick Capture; speech-to-text, then natural-language parsing. Uses OS speech services where available. |

### 7.3 AI features (P1, Phase 3 — require internet + user's own free Gemini API key)

All AI features are **optional**, off until the user adds a key, and clearly marked with a small ✦ icon. The app is fully usable without them.

| ID | Feature | Behaviour |
|----|---------|-----------|
| A1 | Screenshot / image → task | Drag, paste, or pick an image (receipt, meeting invite, chat screenshot). AI extracts title, date, time, location, amount, notes. User sees a pre-filled form and confirms. Never auto-saves. |
| A2 | Smart natural language | For sentences the offline parser can't handle ("remind me two days before mum's birthday on the 14th"). |
| A3 | Plan my day / week | "Plan my week around my Thursday meeting" → AI proposes a schedule; user accepts all, some, or none. |
| A4 | Auto-reschedule overflow | When today has more planned time than free time, suggest which items to move and where. Suggestion only. |
| A5 | Energy-aware scheduling | Learns from completion times which hours the user finishes most work; suggests slots accordingly. (Pattern learning is local; AI only phrases suggestions.) |

**AI privacy rules:** only the data needed for the single request is sent (e.g., the image, or titles/times for the planned days — never notes or attachments unless the user includes them). A one-time consent screen explains this. The API key is stored in the OS keychain.

### 7.4 Future (P2 — design for, don't build)
Encrypted sync between the user's own devices; mobile apps; two-way Google/Outlook sync; context-aware "leave now" travel reminders; local on-device AI model option; shared lists with family.

## 8. Key user stories

1. As Priya, I want to open Kairos and immediately see what's happening now and what's left today, so I can start my day without thinking.
2. As Priya, I want to add "submit assignment Friday 6pm #learning" in one line, so capture never breaks my flow.
3. As Omar, I want to drop a WhatsApp screenshot of a supplier meeting and get a ready task, so I don't have to type.
4. As Omar, I want big clear buttons with words, so I never wonder what something does.
5. As Lena, I want a habit streak for studying and a dark theme, so planning feels motivating.
6. As any user, I want missed tasks offered a new date kindly, so I don't feel guilty and quit the app.
7. As any user, I want my data backed up automatically to a folder I choose, so a dead laptop never wipes my life plan.
8. As any user, I want reminders even when the window is closed, so nothing slips.
9. Edge: As a user with no tasks, I want an encouraging start screen rather than emptiness.
10. Edge: As a user whose disk is full, I want a clear message that the backup failed and what to do.

## 9. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Performance | Cold start < 2 s on a mid-range laptop; any view switch < 150 ms; smooth with 50,000 items. |
| Size | Installer < 20 MB; idle RAM < 150 MB. |
| Reliability | SQLite WAL mode; integrity check on startup; automatic recovery from latest good backup if DB is corrupt. |
| Privacy | No telemetry by default. Optional opt-in crash reports (anonymised). No network calls except AI (when enabled), update check (toggleable), and crash reports (opt-in). |
| Security | API keys in OS keychain; strict Tauri capability permissions; Content Security Policy; no remote code. |
| Offline | 100% of non-AI features work with no internet. |
| Platforms | Windows 10/11 (x64, ARM64), macOS 12+ (Apple Silicon + Intel). |
| Localisation | All strings in translation files from day one (English first; RTL-ready for Arabic later). Date/time formats follow OS locale; week start configurable. |

## 10. Monetisation and go-to-market

- **Positioning:** "Fully local. Your data stays with you." Premium planner for people tired of cloud subscriptions.
- **Pricing (proposed, to validate):** **Free** — all core features (R1–R10). **Kairos Pro** — one-time purchase or modest yearly licence: habits, goals, templates, focus, weekly review, AI features.
- **Licensing:** offline-verifiable licence key (no account needed).
- **Channels:** Product Hunt launch, Reddit (r/productivity, r/selfhosted, r/privacy), productivity YouTube/newsletters, landing page with tagline and screenshots.

## 11. Open questions

| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Competitor deep-dive: exactly where do Todoist, Motion, Sunsama, Fantastical fall short for our lead user? | Product (Zack) | No — before launch |
| 2 | Final pricing: one-time vs yearly; price point | Product | No — before Phase 4 |
| 3 | Visual references: Zack to review Sunsama and Fantastical and note likes/dislikes | Design (Zack) | No — before Phase 2 UI polish |
| 4 | Logo design | Design | No — before Phase 4 |
| 5 | Code-signing certificates (Apple Developer ID, Windows certificate) — cost and setup | Engineering | Blocking for Phase 4 only |
| 6 | Payment/licence provider (e.g., Lemon Squeezy, Paddle, Gumroad) | Product | No — before Phase 4 |

## 12. Phasing summary

| Phase | Name | Contents |
|-------|------|----------|
| 1 | Foundation | Project setup, database, tasks/events, calendar views, dashboard, Quick Capture (offline NLP), themes, Trash, backups |
| 2 | Smart layer | Reminders & tray, missed-task flow, recurrence, onboarding, search/command palette, time-blocking, accessibility pass, visual polish |
| 3 | Pro & AI | Habits, goals, templates, focus, weekly review, Inbox, AI features (A1–A5), feedback loop |
| 4 | Polish & launch | Performance, licensing, auto-update, signed installers, crash reporting (opt-in), landing page, launch |

Rule: after Phase 1, **use Kairos personally for one week** before starting Phase 2.
