-- 0001 — initial schema (ARCHITECTURE.md §4).
-- NEVER edit this file once released: every schema change is a new numbered migration.
-- IDs are UUID v7 text; timestamps are UTC ISO-8601 text; all-day dates are YYYY-MM-DD.

CREATE TABLE areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,          -- token key, e.g. 'area.work'
  icon TEXT NOT NULL,           -- lucide icon name
  sort_order INTEGER NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

-- Goals and milestones are Phase 3 features; the tables exist now because
-- items.milestone_id references milestones (decision 2026-10-07).
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

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('task','event')),
  title TEXT NOT NULL,
  notes TEXT,                    -- markdown
  area_id TEXT REFERENCES areas(id),
  priority INTEGER NOT NULL DEFAULT 0,   -- 0 none, 1 low, 2 med, 3 high
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

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); -- JSON values

CREATE TABLE backup_log (
  id TEXT PRIMARY KEY, path TEXT NOT NULL, kind TEXT NOT NULL,  -- auto|manual|pre_restore|pre_migration
  size_bytes INTEGER, item_count INTEGER, ok INTEGER NOT NULL, error TEXT, created_at TEXT NOT NULL
);

-- Full-text search over item titles and notes (external content table on items.rowid).
-- items has a TEXT primary key, so its rowid is implicit: never VACUUM without running
-- INSERT INTO items_fts(items_fts) VALUES('rebuild') afterwards.
CREATE VIRTUAL TABLE items_fts USING fts5(title, notes, content='items', content_rowid='rowid');

CREATE TRIGGER items_fts_after_insert AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
END;

CREATE TRIGGER items_fts_after_delete AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, title, notes) VALUES ('delete', old.rowid, old.title, old.notes);
END;

CREATE TRIGGER items_fts_after_update AFTER UPDATE OF title, notes ON items BEGIN
  INSERT INTO items_fts(items_fts, rowid, title, notes) VALUES ('delete', old.rowid, old.title, old.notes);
  INSERT INTO items_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
END;
