-- 0006 — focus sessions (P3-T05), as in ARCHITECTURE §4 (plus updated_at/deleted_at, as on
-- every table). One row per stretch of focused work: pausing ends it, resuming starts another.
-- NEVER edit this file once released: add a new numbered migration instead.
CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY, item_id TEXT REFERENCES items(id),
  started_at TEXT NOT NULL, ended_at TEXT, planned_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX idx_focus_sessions_started ON focus_sessions(started_at);
