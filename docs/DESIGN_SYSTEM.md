# Kairos — Design System & Brand Guidelines

## 1. Brand

| | |
|---|---|
| **Name** | Kairos |
| **Meaning** | Ancient Greek: the opportune, decisive moment — the *right* time to act (as opposed to *chronos*, clock time). |
| **Tagline** | *The perfect moment to act.* |
| **Personality** | Calm · Premium · Confident · Warm · Clear |
| **Feels like** | A beautifully made leather planner with a gold-edged page — but smart. |
| **Never feels like** | Corporate dashboard, noisy gamified app, cheap template, guilt machine. |

### Logo direction (to be designed)
Wordmark "Kairos" in Fraunces, medium weight, slightly tightened letter-spacing. Symbol idea: a minimal circle (time) with a single gold tick/notch at the top-right — "the moment". Must work in one colour at 16 px (tray icon).

### Voice & copy
- Plain, short, human. Write for a 12-year-old reading level.
- Verbs on buttons: "Add task", "Remind me", "Move to today" — never "Submit", "OK", "Execute".
- Encouraging, never scolding: "3 things slipped by — want to give them a new moment?" not "You have 3 overdue tasks!"
- No jargon: "Repeat" not "Recurrence"; "Backup copy" not "Snapshot".
- Use the brand idea gently: "Your moment", "Make time", "Right on time".

## 2. UX principles (the "anyone can use it" rules)

1. **The main action is always obvious.** "+ Add" is the largest, gold, always-visible button.
2. **Icons always come with words.** Navigation and primary actions show icon + label. Icon-only buttons are allowed only in dense toolbars and must have a tooltip and accessible name.
3. **Recognition over memory.** Show options; don't make users remember commands. Shortcuts are bonuses, never required.
4. **Forgiving.** Every destructive action is undoable (toast with Undo for 8 s) or goes to Trash. Confirm dialogs only for irreversible actions (empty Trash, restore backup).
5. **One screen, one job.** Each screen has one clear purpose and one primary button.
6. **Useful from the first second.** No empty voids — every empty state has a friendly line and one action.
7. **Show, don't configure.** Smart defaults; settings are optional refinements.
8. **Big targets.** Minimum clickable size 36×36 px (44×44 for primary actions).
9. **Status never relies on colour alone.** Always colour + icon + label.
10. **Rich, not cluttered.** Density through good hierarchy (size, weight, spacing), not by shrinking everything.

## 3. Colour

All colours are defined as CSS custom properties in `src/styles/tokens.css` and mapped to Tailwind. **Components never use raw hex values.**

### 3.1 Brand core
| Token | Hex | Use |
|-------|-----|-----|
| `--brand-midnight` | `#0B0F1A` | Deep base, dark background, logo |
| `--brand-gold` | `#C9A24A` | Signature accent: primary buttons, "now" marker, focus |
| `--brand-gold-soft` | `#E6CF94` | Highlights, hover glows in dark mode |
| `--brand-gold-deep` | `#8A6516` | Gold **text** on light backgrounds (AA compliant) |
| `--brand-ivory` | `#FAF8F4` | Light background |

### 3.2 Semantic tokens

| Token | Light | Dark |
|-------|-------|------|
| `--bg` (app background) | `#FAF8F4` | `#0B0F1A` |
| `--surface` (cards, panels) | `#FFFFFF` | `#121828` |
| `--surface-2` (sidebar, inputs) | `#F3F0E9` | `#1A2134` |
| `--surface-3` (hover, selected) | `#EAE5DA` | `#232B40` |
| `--border` | `#E4DFD4` | `#2A3349` |
| `--border-strong` | `#CFC8B8` | `#3A4560` |
| `--text` | `#12172A` | `#EEF0F5` |
| `--text-muted` | `#5B6478` | `#A1A9BB` |
| `--text-subtle` | `#656D7E` | `#7F889C` |
| `--accent` | `#C9A24A` | `#D4AF5A` |
| `--accent-hover` | `#B48E38` | `#E2C27A` |
| `--accent-text` (gold text) | `#8A6516` | `#E2C27A` |
| `--on-accent` (text on gold) | `#12172A` | `#0B0F1A` |
| `--focus-ring` | `#8A6516` | `#E2C27A` |
| `--success` | `#2F8F62` | `#4CC38A` |
| `--warning` (missed) | `#C7772A` | `#F0A35E` |
| `--danger` (destructive only) | `#C2413B` | `#F07068` |
| `--on-danger` (text on danger) | `#FFFFFF` | `#0B0F1A` |
| `--info` | `#3B6FD8` | `#7AA2F7` |

### 3.3 Life-area colours (user can change)
| Area | Light | Dark | Default icon |
|------|-------|------|--------------|
| Work | `#3B6FD8` | `#7AA2F7` | `briefcase` |
| Home | `#2F8F62` | `#4CC38A` | `house` (Lucide renamed `home`) |
| Personal | `#C2547A` | `#F28BAE` | `heart` |
| Learning | `#7B5BD6` | `#AE96F5` | `graduation-cap` |
| Health | `#1E9C9A` | `#4FD1CF` | `activity` |

Areas appear as a 4 px left stripe on item cards, a small dot in lists, and a soft tint (10% opacity) for calendar blocks.

### 3.4 Status
| Status | Colour | Icon | Label |
|--------|--------|------|-------|
| Ongoing / Now | `--accent` (gold) for fills + soft pulse; `--accent-text` for icon and text | `circle-dot` | "Now" |
| Upcoming | `--info` | `clock` | "Upcoming" |
| Missed | `--warning` (amber, never red) | `rotate-ccw` | "Slipped" |
| Done | `--success` | `check-circle-2` | "Done" |
| Skipped | `--text-subtle` | `minus-circle` | "Skipped" |
| Due today *(added P1-T08, pending Zack's confirmation)* | `--accent-text` (`--status-today`) | `sun` | "Today" |
| Past *(events only; added P1-T08, pending confirmation)* | `--text-subtle` (`--status-past`), shown muted | `history` | "Past" |
| No date (Inbox) | `--text-subtle` | `inbox` | "No date" |

Checkbox ring (unchecked) uses `--text-subtle`, not `--border`, so the control meets the 3:1 non-text contrast rule.

### 3.5 Contrast
- Body text ≥ 4.5:1, large text and UI parts ≥ 3:1 (WCAG 2.2 AA). Verify both themes with an automated contrast check in tests.
- Gold is a **fill/accent** colour; use `--accent-text` when gold is the text colour on light backgrounds.
- *Change log (2026-10-07, approved by Zack):* `--text-subtle` (both themes), light `--focus-ring`, the "Now" icon colour, and a new `--on-danger` token were adjusted so every pair meets AA. The original values measured 2.26–4.26:1.

## 4. Typography

| Role | Font | Size / line-height | Weight |
|------|------|--------------------|--------|
| Display (greeting, empty states) | Fraunces | 36 / 44 | 500 |
| H1 (screen title) | Fraunces | 28 / 36 | 500 |
| H2 (section) | Inter | 20 / 28 | 600 |
| H3 (card title) | Inter | 16 / 24 | 600 |
| Body | Inter | 15 / 22 | 400 |
| Small / meta | Inter | 13 / 18 | 500 |
| Caption / tag | Inter | 12 / 16 | 500, +2% tracking |
| Time & numbers | Inter with `font-variant-numeric: tabular-nums` (or JetBrains Mono) | — | 500 |

- Fallback stacks: `Fraunces, Georgia, 'Times New Roman', serif` and `Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`.
- Text-size setting scales the root: Small 0.9, Default 1.0, Large 1.125, XL 1.25.
- Fraunces is used sparingly — headings and moments of delight only. All functional UI is Inter.

## 5. Spacing, shape, depth

- **Spacing scale (4 px base):** 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Radius:** `sm 6px` (chips, inputs) · `md 10px` (buttons, cards) · `lg 16px` (panels, dialogs) · `full` (avatars, pills).
- **Shadows (light):** `sm 0 1px 2px rgba(18,23,42,.06)` · `md 0 4px 12px rgba(18,23,42,.08)` · `lg 0 12px 32px rgba(18,23,42,.12)`.
- **Dark mode depth:** use lighter surfaces (`surface` → `surface-3`) and a 1 px `--border` instead of heavy shadows. Optional faint gold inner glow on the focused/active card.
- **Grid:** 8 px layout grid; content max width 1280 px; sidebar 248 px (collapsible to 72 px icon rail with tooltips).

## 6. Motion & animation

Motion in Kairos should feel **calm, quick, and purposeful**: it explains what changed and where things went. It never decorates or slows the user down.

### 6.1 Tokens
| Token | Value | Use |
|-------|-------|-----|
| `--dur-instant` | 80 ms | Press feedback, checkbox tick |
| `--dur-fast` | 120 ms | Hover, focus ring, colour changes |
| `--dur-base` | 200 ms | Panels, popovers, toasts, list reorder |
| `--dur-slow` | 320 ms | Screen transitions, entrance of sections |
| `--dur-gentle` | 2400 ms | Ambient loops ("now" pulse) |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Default for everything entering or moving |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Things leaving (closing panels, dismissed toasts) |
| `--ease-spring` | Motion spring `{ stiffness: 400, damping: 32 }` | Drag-and-drop settle, checkbox fill |
| `--stagger` | 60–80 ms | Delay between items/sections entering |

### 6.2 Where each animation goes

| Section / element | Animation | Duration / easing | Purpose |
|-------------------|-----------|-------------------|---------|
| **App open → My Day** | Greeting, timeline, then sections fade + rise 8 px, staggered | 320 ms, ease-out, 80 ms stagger, max 5 steps | Feels welcoming; draws the eye top → bottom |
| **Greeting summary line** | Numbers count up from 0 on first open of the day only | 400 ms | Small moment of delight, once per day |
| **"Now" marker** (timeline line + dot, Now heading dot) | Soft gold pulse: scale 1 → 1.35, opacity 1 → 0.65 | 2.4 s loop, ease-out | Shows "this is live, this is now" |
| **Day timeline "now" line** | Moves smoothly across as time passes (updates each minute with a 1 s glide) | 1 s ease-out | Time feels alive, never jumps |
| **Complete a task (signature)** | Checkbox fills gold from centre, white tick draws on (stroke-dashoffset), thin gold arc sweeps once around, title strikes through left → right and fades to muted; item then slides into "Done today" | 80 ms fill → 200 ms tick → 400 ms total; slide 200 ms | The reward moment: calm satisfaction, no confetti |
| **Undo toast** | Slides up 12 px + fade in; progress hairline shrinks over 8 s | 200 ms in, ease-in out | Shows how long Undo is available |
| **Slipped card** | Gentle fade-in after the Now section; when an item is moved, it collapses height to 0 and the card re-measures; when empty, card fades out and shows a 1-line "All caught up" | 200 ms collapse, 320 ms card exit | Calm resolution, never alarming. **No shaking, no red flashes** |
| **Add task (+ Add button)** | Button presses to 0.97 scale; item editor side panel slides in from right 24 px + fade | 80 ms press; 200 ms panel | Clear cause → effect |
| **New item appears in a list** | Expands from height 0, background flashes a soft gold tint that fades out | 200 ms expand, 900 ms tint fade | "Here's what you just added" |
| **Quick Capture window** | Scales 0.96 → 1 + fade, backdrop blur in; parsed chips pop in one by one as recognised | 160 ms window; chips 120 ms each | Feels instant and smart |
| **Calendar view switch** (Day/Week/Month) | Cross-fade + 8 px horizontal slide in the direction of time | 200 ms | Keeps spatial sense of time |
| **Calendar next/previous** | Grid slides 24 px left/right with fade | 200 ms | Direction = past or future |
| **Drag & drop** (move/resize events) | Lifted item gets `shadow-lg` + 1.02 scale; drop target slot highlights gold outline; item settles with spring | Spring | Physical, trustworthy feel |
| **Sidebar collapse** | Width animates 248 → 72 px; labels fade out first, then width | 200 ms | No jarring jump |
| **Theme switch** | Colours cross-fade on `background-color`, `color`, `border-color` only | 200 ms | Smooth, no flash |
| **Habits tick** | Same gold fill as tasks; streak number flips up (old number slides out, new in) | 200 ms | Streak growth feels rewarding |
| **Streak milestone** (7, 30, 100 days) | Small gold sparkle ring around the streak count once | 600 ms, once | Celebrate quietly |
| **Progress bars / rings** (goals, balance) | Fill animates from previous value to new | 400 ms ease-out | Shows progress happening |
| **Focus mode enter** | Everything else dims to 0 and the chosen task scales to centre; timer ring starts drawing | 320 ms | Calm transition into deep work |
| **Reminder notification arrives (in-app)** | Banner slides down from top bar with a soft single gold glow | 200 ms | Noticeable, not startling |
| **Skeleton loaders** | Soft shimmer left → right using `surface-2` → `surface-3` | 1.2 s loop | Shows loading without spinners |
| **Hover on cards/rows** | Background → `surface-3`, 1 px lift on cards | 120 ms | Responsive, alive |
| **Empty states** | Illustration/icon fades in after content, 100 ms later | 320 ms | Feels intentional, not broken |

### 6.3 Rules
- Animate only `opacity` and `transform` (plus colour for theme switch) — never width/height in loops — to stay smooth at 60 fps.
- Nothing longer than 400 ms in a user-triggered action. Users must never wait for an animation to finish to keep working.
- Every animation is interruptible (clicking again cancels/reverses it).
- Never animate in a way that suggests failure or guilt (no shake on slipped items, no red flashing).
- **Reduce motion:** when the OS setting is on, replace all movement with 120 ms fades and stop all loops (now-pulse, shimmer).
- Implement with **Motion** (`motion/react`) for component transitions and CSS keyframes for simple loops. Put shared variants in `src/lib/motion.ts` so every screen uses the same values.

## 7. Layout & screens

```
┌──────────────────────────────────────────────────────────────┐
│ Kairos   [ Search or type a command…  ⌘K ]   [+ Add task]  ☀/☾ │  ← top bar
├────────────┬─────────────────────────────────────────────────┤
│ ◎ My Day   │                                                 │
│ ▦ Calendar │            Main content area                    │
│ ⬚ Inbox  3 │                                                 │
│ ◆ Goals    │                                                 │
│ ↻ Habits   │                                                 │
│ ── Areas ──│                                                 │
│ ● Work     │                                                 │
│ ● Home     │                                                 │
│ ● Personal │                                                 │
│ ● Learning │                                                 │
│ ● Health   │                                                 │
│            │                                                 │
│ ⚙ Settings │                                                 │
└────────────┴─────────────────────────────────────────────────┘
```

### My Day (dashboard)
- Fraunces greeting: "Good morning, Priya." + date + one-line summary.
- A slim **day timeline** across the top with a gold "now" line.
- Columns (≥1200 px) or stacked sections: **Now**, **Today**, **Slipped**, **This week**; **Done today** collapsed at bottom.
- Right rail (optional, ≥1400 px): mini-month, habits for today, area balance ring.

### Calendar
- View switcher: Day · Week · Month · Agenda (segmented control with labels).
- Hour rows 56 px tall; gold horizontal "now" line with a dot.
- Events = tinted blocks with area stripe; tasks with times = blocks with a checkbox; date-only tasks = chips in the all-day row.
- Drag to create (click-drag on empty grid opens a quick editor pre-filled with that time).

### Item editor
- Opens as a right-side panel (not a full modal) so the calendar stays visible.
- Title field large and autofocused. Below: a row of friendly "pills" — 📅 Date, ⏰ Time, 🔔 Remind me, ↻ Repeat, ● Area, ⚑ Priority — each opens a simple picker. Advanced fields (location, attachments, checklist, notes) under "More details".

### Quick Capture window
- 560 px wide floating bar, rounded `lg`, `shadow-lg`, blurred backdrop.
- Placeholder: "What needs a moment? e.g. Call bank tomorrow 3pm #home".
- Parsed parts appear as removable chips beneath. Enter = save, Esc = close.

## 8. Component inventory

Built from shadcn/ui primitives, restyled with tokens:
Button (primary gold · secondary · ghost · destructive), IconButton (with tooltip), Input, Textarea, Select, Combobox, DatePicker, TimePicker, Checkbox (round, gold), Switch, SegmentedControl, Tabs, Card, ItemCard, Chip/Tag, AreaDot, StatusBadge, Avatar, Tooltip, Popover, DropdownMenu, ContextMenu (right-click on items), Dialog, SidePanel, Toast (with Undo), EmptyState, Skeleton, ProgressBar, ProgressRing, StreakCounter, Heatmap, Timeline, CommandPalette, KeyboardShortcutHint.

### Button specs
| Variant | Background | Text | Height |
|---------|------------|------|--------|
| Primary | `--accent` | `--on-accent` | 40 px (44 px for "+ Add task") |
| Secondary | `--surface-2` + `--border` | `--text` | 36–40 px |
| Ghost | transparent → `--surface-3` on hover | `--text` | 36 px |
| Destructive | `--danger` | `--on-danger` | 40 px |

Focus: 2 px `--focus-ring` outline with 2 px offset, always visible on keyboard focus.

## 9. Empty states (examples)
- My Day, nothing today: "A clear day. Perfect moment to plan something that matters." [+ Add task]
- Inbox empty: "All caught up. Drop anything here — a thought, a screenshot, a voice note."
- Search no results: "Nothing found for "dentist". Create it as a new task?" [Create]

## 10. Theming implementation
- `tokens.css` defines `:root` (light) and `[data-theme="dark"]`; "Match system" listens to `prefers-color-scheme`.
- Theme switch is instant, persisted in settings, and applied before first paint (no flash).
- Area colours exist in both light and dark variants and are referenced by token key, so a theme change updates everything.

## 11. Visual references (to review)
Zack to review and note likes/dislikes before Phase 2 polish: **Sunsama** (daily planning structure), **Fantastical** (calendar polish and theming), **Notion** (rich-but-organised density), **Things 3** (calm, premium task feel).
