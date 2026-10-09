-- 0005 — templates (P3-T04), as in ARCHITECTURE §4.
-- NEVER edit this file once released: add a new numbered migration instead.
CREATE TABLE templates (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  payload TEXT NOT NULL,        -- JSON: items with relative day/time offsets
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
