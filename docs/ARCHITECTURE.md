# Kairos — Architecture

## 1. High-level overview

```mermaid
flowchart LR
  subgraph UI["Frontend (React + TS in OS WebView)"]
    V[Screens & components] --> Q[TanStack Query hooks]
    V --> Z[Zustand UI store]
  end
  Q -- "invoke('command', args)" --> C
  subgraph Core["Backend (Rust, Tauri)"]
    C[Command layer<br/>validation] --> S[Services<br/>items, recurrence, status, backup, ai]
    S --> R[Repositories<br/>SQL only here]
    R --> DB[(SQLite file<br/>kairos.db)]
    S --> B[Backup manager]
    S --> N[Scheduler<br/>reminders]
    S --> A[AI provider<br/>Gemini]
  end
  N --> OS[OS notifications / tray]
  B --> F[(Backup folders)]
  A -. HTTPS, opt-in .-> G[Gemini API]
```

- The **frontend** is purely presentation + interaction. It never runs SQL and never calls the internet.
- The **Rust backend** owns data, time, files, notifications, and network.
- Communication is through typed **Tauri commands** (request/response) and **events** (backend → frontend pushes, e.g., `items:changed`, `reminder:fired`).

## 2. Repository layout

```
kairos/
├─ CLAUDE.md                 # copy of PROJECT_RULES.md
├─ docs/                     # this document set
├─ src/                      # frontend
│  ├─ app/                   # router, providers, layout shell
│  ├─ features/
│  │  ├─ dashboard/
│  │  ├─ calendar/           # day, week, month, agenda views
│  │  ├─ items/              # item editor, item card, checklist
│  │  ├─ capture/            # quick capture, NL parser
│  │  ├─ inbox/
│  │  ├─ habits/  goals/  templates/  focus/  review/
│  │  ├─ search/             # command palette
│  │  ├─ settings/  onboarding/  backup/
│  │  └─ ai/
│  ├─ components/ui/         # shadcn/ui primitives (restyled)
│  ├─ lib/
│  │  ├─ api/                # typed wrappers around invoke()
│  │  ├─ dates/  nlp/  recurrence/
│  │  └─ utils.ts
│  ├─ styles/                # tokens.css, globals.css, fonts
│  ├─ i18n/locales/en.json
│  └─ types/                 # generated from Rust (ts-rs / specta)
├─ src-tauri/
│  ├─ src/
│  │  ├─ main.rs  lib.rs
│  │  ├─ commands/           # thin: validate → call service
│  │  ├─ services/           # business logic
│  │  ├─ repo/               # SQL queries
│  │  ├─ db/  (pool.rs, migrations/)
│  │  ├─ scheduler/          # reminder engine
│  │  ├─ backup/
│  │  ├─ ai/                 # AiProvider trait + gemini.rs
│  │  └─ error.rs
│  ├─ capabilities/          # Tauri permission files
│  └─ tauri.conf.json
└─ tests/e2e/
```

## 3. Type sharing
Rust structs are the source of truth. TypeScript types are generated with **`ts-rs`** into `src/types/` (decision 2026-10-07: tauri-specta for Tauri 2 is still a release candidate). Structs use `#[cfg_attr(test, derive(ts_rs::TS), ts(export))]` and `#[serde(rename_all = "camelCase")]`; integers crossing the boundary are `i32` (never `bigint`). Run `pnpm test:rust` to regenerate; CI fails if `src/types/` is out of date. Command wrappers are written by hand in `src/lib/api/` and tested against the command names. Frontend validates user input with Zod before sending; backend validates again.

## 4. Data model (SQLite)

Conventions: IDs are **UUID v7** text (time-sortable, sync-friendly). Timestamps are **UTC ISO-8601** text; all-day dates are `YYYY-MM-DD` text; the user's timezone is stored in settings and applied in the UI. Every table has `created_at`, `updated_at`, and `deleted_at` (soft delete → Trash).

```sql
CREATE TABLE areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,          -- token key, e.g. 'area.work'
  icon TEXT NOT NULL,           -- lucide icon name
  sort_order INTEGER NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('task','event')),
  title TEXT NOT NULL,
  notes TEXT,                    -- markdown
  area_id TEXT REFERENCES areas(id),
  priority INTEGER NOT NULL DEFAULT 0,   -- 0 none,1 low,2 med,3 high
  all_day INTEGER NOT NULL DEFAULT 0,
  start_at TEXT,                 -- UTC datetime, or NULL
  end_at TEXT,
  due_date TEXT,                 -- for date-only tasks
  completed_at TEXT,
  skipped_at TEXT,
  location TEXT,
  rrule TEXT,                    -- RFC 5545 recurrence rule
  recurrence_parent_id TEXT REFERENCES items(id),
  original_start_at TEXT,        -- for edited occurrences
  milestone_id TEXT REFERENCES milestones(id),
  reschedule_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual', -- manual|quick|nlp|ai_image|template|import
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX idx_items_start ON items(start_at);
CREATE INDEX idx_items_due ON items(due_date);
CREATE INDEX idx_items_area ON items(area_id);

CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id),
  text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id),
  offset_minutes INTEGER NOT NULL,      -- minutes before start/due (0 = at time)
  fire_at TEXT,                          -- computed next fire time (UTC)
  fired_at TEXT, snoozed_until TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX idx_reminders_fire ON reminders(fire_at);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id),
  file_name TEXT NOT NULL, mime TEXT NOT NULL, size_bytes INTEGER NOT NULL,
  rel_path TEXT NOT NULL,     -- inside app-data/attachments/
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE inbox_entries (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('text','image','voice')),
  text TEXT, attachment_id TEXT REFERENCES attachments(id),
  processed_item_id TEXT REFERENCES items(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
  area_id TEXT REFERENCES areas(id), target_date TEXT, achieved_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE milestones (
  id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES goals(id),
  title TEXT NOT NULL, target_date TEXT, sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE habits (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, area_id TEXT REFERENCES areas(id),
  frequency TEXT NOT NULL,      -- 'daily' | 'weekly:3' | rrule
  reminder_time TEXT,           -- local HH:MM
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE TABLE habit_logs (
  id TEXT PRIMARY KEY, habit_id TEXT NOT NULL REFERENCES habits(id),
  log_date TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(habit_id, log_date)
);

CREATE TABLE templates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  payload TEXT NOT NULL,        -- JSON: items with relative day/time offsets
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY, item_id TEXT REFERENCES items(id),
  started_at TEXT NOT NULL, ended_at TEXT, planned_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL,   -- idea|frustration|bug
  text TEXT NOT NULL, context TEXT, status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); -- JSON values
CREATE TABLE backup_log (
  id TEXT PRIMARY KEY, path TEXT NOT NULL, kind TEXT NOT NULL,  -- auto|manual|pre_restore
  size_bytes INTEGER, item_count INTEGER, ok INTEGER NOT NULL, error TEXT, created_at TEXT NOT NULL
);

-- Full-text search
CREATE VIRTUAL TABLE items_fts USING fts5(title, notes, content='items', content_rowid='rowid');
```

**Recurrence:** a recurring item is stored once with an `rrule`. Occurrences are **expanded on read** for the visible date range. Completing/editing a single occurrence creates an exception row (`recurrence_parent_id` + `original_start_at`).

**Status** is **computed**, not stored (see PRD §6), so it is always correct as time passes.

## 5. Storage locations
- Database: `{appDataDir}/kairos.db` (WAL mode, `foreign_keys=ON`, `synchronous=NORMAL`)
- Attachments: `{appDataDir}/attachments/{yyyy}/{mm}/{uuid}.{ext}`
- Backups: `{appDataDir}/backups/` + optional user folder
- Damaged database files (startup recovery): `{appDataDir}/damaged/`
- Logs: `{appLogDir}/kairos.log` (rotated, no personal content)

## 6. Key flows

### 6.1 Startup
1. Open DB → `PRAGMA integrity_check` (quick_check). If it fails → restore latest good backup automatically, show a calm notice.
2. Run pending migrations (back up first if any are pending).
3. Start scheduler; register global shortcut; create tray.
4. Frontend loads Dashboard query → render within 2 s.

### 6.2 Reminder scheduler (Rust)
- Single async loop: find the next `fire_at` across reminders, sleep until then (max 60 s, to survive sleep/clock changes), fire due notifications, compute next `fire_at` (recurrence aware).
- On system wake / time change → recompute.
- Missed reminders while the computer was off: show one combined notification ("While you were away: 3 reminders").

### 6.3 Backups
- Use SQLite **Online Backup API** (safe while running) through a **separate read-only connection**, so the app's connection is never blocked → write `kairos-<label>-YYYYMMDD-HHMMSS.mmm.db` (UTC). Labels: `auto`, `manual`, `pre-restore`, `pre-migration`, `pre-purge`. Attachments folder copy: added with attachments (P2-T11).
- When: every 24 h (background check every 30 min) and on every app close; "Back up now"; automatically before a migration, a restore, or a Trash purge.
- Retention: automatic → newest per day for the last 14 backup days, then newest per ISO week for 8 more weeks; safety copies (`pre-*`) → newest 10 of each; manual backups are never removed. Applied to the app folder and the extra folder.
- Verify each backup by opening it read-only (`PRAGMA quick_check` + item count); record successes and failures in `backup_log` (failures are shown in Settings › Backups).
- Optional extra folder (settings key `backup.folder`): every backup is copied there; its backups are listed and restorable too.
- Restore: validate the file name (no paths) → verify the backup → back up current data (`pre-restore`) → copy the backup into the live connection with the Online Backup API → run migrations → emit `data:reloaded` (every window refetches everything).

### 6.3a Startup integrity & recovery (P1-T15)
`PRAGMA quick_check` on the database file before opening. If it fails (or the file can't be read): move the file and its `-wal`/`-shm` into `{appDataDir}/damaged/` (never deleted) → copy in the newest backup that passes verification → show a one-time calm notice (`take_startup_notice`). With no good backup, Kairos starts with a fresh database and the notice says where the damaged file was kept. Trash items older than 30 days are purged at startup (backed up first).

### 6.4 Quick Capture
Global shortcut → small always-on-top Tauri window → user types → frontend parses with chrono-node + tag parser → shows chips → Enter → `create_item` command → window hides → main window receives `items:changed`.

### 6.5 AI image → task
Frontend sends image path → Rust `ai_extract_from_image` → reads key from keychain → downscales image (max 1600 px) → calls Gemini with a strict JSON schema prompt → validates JSON → returns draft → user edits and confirms → `create_item`. Timeouts 20 s; friendly error on failure; never blocks other features.

## 7. Command API (initial)

| Command | Purpose |
|---------|---------|
| `list_items(range, filters)` | Items + expanded occurrences in a date range |
| `get_dashboard(today)` | Pre-grouped Now/Today/Missed/Week/Done |
| `create_item`, `update_item`, `delete_item`, `restore_item`, `complete_item`, `uncomplete_item`, `reschedule_item` | Item CRUD |
| `list_areas`, `upsert_area`, `archive_area` | Life areas |
| `search(query)` | FTS search |
| `get_settings`, `set_setting` | Settings |
| `backup_now`, `list_backups`, `restore_backup`, `set_backup_folder` | Backups |
| `export_json`, `export_ics`, `import_ics` | Portability |
| `snooze_reminder`, `dismiss_reminder` | Reminder actions |
| `ai_set_key`, `ai_clear_key`, `ai_extract_from_image`, `ai_parse_text`, `ai_plan_range` | AI (Phase 3) |

All commands return `Result<T, AppError>`; `AppError` has a `code` and a user-safe `message` key for i18n.

## 8. Security
- Tauri capabilities: grant only needed plugins/permissions per window (main vs capture window).
- CSP: `default-src 'self'`; `connect-src` none from the frontend (network only in Rust).
- No `eval`, no remote scripts, no remote fonts.
- Gemini key: OS keychain only; never in DB, logs, or exports.
- Attachments opened via OS default app; never executed by Kairos.

## 9. Designing for the future (P2)
- **Sync:** UUID v7 IDs, `updated_at` on every row, soft deletes → enables later last-write-wins or CRDT sync with end-to-end encryption.
- **Mobile:** Tauri 2 mobile targets; keep business logic in Rust services, UI responsive down to 360 px.
- **Local AI:** `AiProvider` trait — `GeminiProvider` now, `OllamaProvider` later.
