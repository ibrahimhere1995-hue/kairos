-- 0003 — attachments (P2-T11), as defined in ARCHITECTURE §4.
-- NEVER edit this file once released: add a new numbered migration instead.
-- The files live in {appDataDir}/attachments/<rel_path> and are never changed.

CREATE TABLE attachments (
  id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id),
  file_name TEXT NOT NULL, mime TEXT NOT NULL, size_bytes INTEGER NOT NULL,
  rel_path TEXT NOT NULL,     -- inside app-data/attachments/
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
CREATE INDEX idx_attachments_item ON attachments(item_id);
