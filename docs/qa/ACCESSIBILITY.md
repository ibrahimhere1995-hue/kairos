# Accessibility pass (P2-T13) — results, 2026-10-09

Goal: WCAG 2.2 AA, PROJECT_RULES #6 (keyboard reachable, visible focus, accessible names, AA contrast, icon + text, reduce motion).

## Automated checks (run with every change)

| Check | Where | Result |
|-------|-------|--------|
| **axe-core** (WCAG 2.0–2.2 A/AA + best practice) on the real app: welcome screens, My Day, Calendar (day, week, month, agenda), Inbox, Trash, Settings, Quick Capture, item editor, search palette, in light **and** dark | `tests/e2e/specs/accessibility.e2e.ts` (`pnpm test:e2e`) | ✅ no violations |
| axe-core on every screen and dialog in unit tests (colour checks left to the E2E scan) | `src/test/a11y.test.tsx` | ✅ |
| Colour contrast of every text, UI and area colour token, both themes | `src/styles/contrast.test.ts` | ✅ |
| Every animation has a reduce-motion version | `src/styles/motion.test.ts` | ✅ |
| Keyboard paths: skip link → top bar → sidebar; editor opens with the title focused, Esc closes; palette arrows + Enter; slipped-card and routine buttons; scope prompt focuses "Only this one"; Settings switches | React Testing Library tests per screen | ✅ |
| Default and Extra large text at 960 px, both themes (Small and Large sit between) | UI-checklist screenshots (`ui-checklist.e2e.ts`) | ✅ |

**Fixed in this pass:** the calendar's hour grid could not be scrolled from the keyboard on an empty day (now a focusable, labelled region); month-view item chips were smaller than the 24 px minimum target (now 24 px).

## Known limits

- Calendar drag and drop works with the keyboard (Space to pick up, arrows, Space to drop), but the easiest keyboard route is still opening the item (Enter) and using the Date / Time pills.
- The "To schedule" list is drag-only for time-blocking; keyboard users open the task and set its time in the editor.
- macOS VoiceOver has not been tried yet (Windows-only builds so far); it's on the Phase 2 checkpoint list.

## 10-minute NVDA check (by hand)

NVDA is free: <https://www.nvaccess.org>. Start it, open Kairos, and use only the keyboard.

1. **Tab** from the top: you hear "Skip to main content", then the search box, "Add task", the theme button, then each sidebar link with its name.
2. **Ctrl+K**, type part of a task title: NVDA reads the selected result as you press ↓; **Enter** opens it.
3. In the editor: the title is read as "Title, edit"; each pill is read as "Date: Tomorrow, button" etc.; **Esc** closes (with "You have unsaved changes" if you typed).
4. On My Day: tick a task with **Space**; you hear the "Done" toast and can reach **Undo**.
5. In the Slipped card: each task's buttons are read as a group "Choices for …".
6. Settings: switches are read as "Daily summary, switch, on"; text size options as a radio group.
7. Turn on Windows **Settings › Accessibility › Visual effects › Animation effects: Off**: panels and toasts fade instead of sliding; the "Now" dot stops pulsing.

Anything that sounds confusing or isn't read at all is a bug: note the screen and what you pressed.
