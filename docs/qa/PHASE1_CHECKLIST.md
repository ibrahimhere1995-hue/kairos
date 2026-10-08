# Phase 1 test pass (P1-T17) — results, 2026-10-08

## End-to-end (critical paths)
`pnpm test:e2e` on Windows 11, WebView2 154. The real app runs on a fresh data folder. Two runs in a row, both green.

| Test | Result |
|------|--------|
| Create a task with Quick Capture (date, area, priority parsed) | ✅ |
| Complete with one click, then Undo | ✅ |
| Slipped task → editor → date "Today" → Save → moves to Today | ✅ |
| Back up now → move item to Trash → restore the backup → item is back | ✅ |
| UI checklist screenshots (below) | ✅ |

## UI checklist
Screenshots: My Day, Calendar (week), Trash, Settings, Quick Capture, item editor. Each in Light and Dark, at Default and Extra large text, at 960 px wide (`tests/e2e/specs/ui-checklist.e2e.ts`; images saved to `.devdata/e2e/screens`, not committed).

| Check | How it was verified | Result |
|-------|---------------------|--------|
| Light and dark themes | Screenshots, all screens | ✅ |
| 4 text sizes, 960 px | Screenshots at Default + Extra large (the two extremes that matter for layout; Small/Large sit between) | ✅ Nothing clipped or overlapping. At Extra large the week view's all-day chips shorten to a dot + first letter; the full title shows on hover and in the screen-reader name. |
| Keyboard only, visible focus, Esc closes overlays | Unit tests (React Testing Library) for every screen + E2E (Esc closes the editor) | ✅ |
| Loading, empty and error states | Unit tests per screen; empty states seen in screenshots (Trash) | ✅ |
| Destructive actions undoable / Trash | E2E (complete + Undo, Trash + restore) and unit tests | ✅ |
| Icons labelled (`aria-label` / tooltip) | E2E finds every control by its accessible name | ✅ |
| Strings in i18n | Lint + review: no hard-coded JSX strings | ✅ |
| AA contrast | Automated token contrast test (`src/styles/contrast.test.ts`) | ✅ |

## Fixed during this pass
- The editor's time pill showed "15:00" while the rest of the app shows "3:00 PM". It now uses the same locale time format.
- Shortened all-day chips in the week view had no way to see the full title with the mouse. They now show it on hover.

## Not covered yet
- macOS: Tauri's WebDriver doesn't support macOS yet, so E2E runs on Windows only. The checkpoint week covers a manual check.
- Inbox is still a placeholder screen (filled in Phase 2).
