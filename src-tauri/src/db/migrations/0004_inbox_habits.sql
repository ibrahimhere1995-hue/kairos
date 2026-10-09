-- 0004 — Inbox entries (P3-T01) and habits (P3-T02), as in ARCHITECTURE §4.
-- NEVER edit this file once released: add a new numbered migration instead.
-- inbox_entries.image_path: a pasted/picked picture lives in {appDataDir}/attachments/ until the
-- entry becomes a task, when it is recorded as that task's attachment (attachment_id).

CREATE TABLE inbox_entries (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('text','image','voice')),
  text TEXT, attachment_id TEXT REFERENCES attachments(id),
  image_path TEXT,
  processed_item_id TEXT REFERENCES items(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE habits (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, area_id TEXT REFERENCES areas(id),
  frequency TEXT NOT NULL,      -- 'daily' | 'weekly:3'
  reminder_time TEXT,           -- local HH:MM (reminders: later)
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);

CREATE TABLE habit_logs (
  id TEXT PRIMARY KEY, habit_id TEXT NOT NULL REFERENCES habits(id),
  log_date TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(habit_id, log_date)
);
CREATE INDEX idx_habit_logs_habit ON habit_logs(habit_id, log_date);
