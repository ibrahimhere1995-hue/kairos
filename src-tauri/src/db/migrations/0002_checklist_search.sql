-- 0002 — search checklist steps too (P2-T09, PRD R9: titles, notes, checklist items, areas).
-- NEVER edit this file once released: add a new numbered migration instead.
-- Like items_fts (0001), an external-content FTS5 index kept in step by triggers.
-- Soft-deleted steps stay in the index; searches join checklist_items and skip them.

CREATE VIRTUAL TABLE checklist_fts USING fts5(text, content='checklist_items', content_rowid='rowid');
INSERT INTO checklist_fts(checklist_fts) VALUES ('rebuild');

CREATE TRIGGER checklist_fts_after_insert AFTER INSERT ON checklist_items BEGIN
  INSERT INTO checklist_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER checklist_fts_after_delete AFTER DELETE ON checklist_items BEGIN
  INSERT INTO checklist_fts(checklist_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;

CREATE TRIGGER checklist_fts_after_update AFTER UPDATE OF text ON checklist_items BEGIN
  INSERT INTO checklist_fts(checklist_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO checklist_fts(rowid, text) VALUES (new.rowid, new.text);
END;
