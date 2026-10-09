-- 0007 — the feedback wishlist (P3-T07), as in ARCHITECTURE §4 (plus deleted_at, as on every
-- table). Stored only on this computer; it leaves only when the user exports or emails it.
-- NEVER edit this file once released: add a new numbered migration instead.
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('idea','frustration','bug')),
  text TEXT NOT NULL, context TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','planned','done')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
);
