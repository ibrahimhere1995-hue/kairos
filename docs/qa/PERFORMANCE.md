# Performance pass (P4-T01)

Measured 2026-10-10 on the development PC (Windows 11, WebView2 154). Budgets from PROJECT_RULES: cold start < 2 s, view switch < 150 ms, installer < 20 MB, idle RAM < 150 MB, lists over 200 rows virtualised, calendar queries range-bounded.

## Results

| Budget | Result | Verdict |
|--------|--------|---------|
| Cold start < 2 s | Window shown after **0.63 s** (empty data) and **0.59 s** (50,000 items). Debug build with the production page; a release build is faster. | ✅ |
| View switch < 150 ms | Every screen's query takes **7–75 ms** with 50,000 items (table below). Rendering is bounded by the list rules below. | ✅ (query side) |
| Installer < 20 MB | **3.2 MB** NSIS installer (`Kairos_0.2.0_x64-setup.exe`, now with reqwest, keyring and windows). The app itself is 9.1 MB. | ✅ |
| Idle RAM < 150 MB | **87 MB** with normal data (Kairos 8 MB + WebView2 80 MB). **157–182 MB** with the 50,000-item stress database, because My Day loads all 8,054 slipped tasks (it now draws only 50). | ✅ normal use · ⚠️ stress test |
| Lists > 200 rows virtualised | My Day sections and Trash use `VirtualList` (built in P1). **New:** the Slipped card shows 50 at a time ("Show 50 more"), and Agenda shows whole days up to ~200 rows ("Show more days"). Search returns at most 50; the Inbox/"To schedule" list at most 200. | ✅ |
| Calendar queries range-bounded | `list_items` always takes a date range; the 6-week month grid query takes 24 ms with 50,000 items. | ✅ |

## Query times with 50,000 items

`cargo test --release perf_ -- --ignored --nocapture` (`src-tauri/src/perf_tests.rs`). It builds a database of 50,000 items: two years of history and one year ahead, about 45 a day, with done, slipped, Inbox and trashed items. It then times each screen's query (second run, warm cache). It fails if any query takes 100 ms or more.

| Screen | Time |
|--------|------|
| My Day (dashboard) | 67–75 ms |
| Calendar day / week | 20 ms |
| Calendar month (6 weeks) | 24 ms |
| Inbox / To schedule | 13 ms |
| Search "report" | 7 ms |
| Tray / daily summary (every 30 s) | 42–46 ms |
| Trash (516 items) | 10 ms |

To start the app against that database: `KAIROS_PERF_DB=<new file>` keeps it (the test never overwrites an existing file). Then run the debug build with `KAIROS_DATA_DIR` set to its folder.

## How memory was measured

The private memory of `kairos.exe` plus the WebView2 processes it started, 15 s after launch. Note: the `pnpm tauri dev` build loads the unminified dev-server page and uses about 215 MB even when empty. Always measure a bundled build (`pnpm test:e2e` builds one into `src-tauri\target-e2e`).

## Bundle

The production frontend is 1.16 MB of JavaScript (360 KB compressed) plus 38 KB of CSS and bundled Inter/Fraunces fonts (local, no network). It loads from disk, so its size hardly affects startup. Possible trim later: import only the English `chrono-node` parser.

## Open items

- **Stress-test memory: done in P4-T03.** My Day now fetches the newest 200 slipped tasks plus a count, and "Move all to today" moves every one in Rust (`move_all_slipped`). Measured after the change: **158–166 MB** (was 157–182 MB), window in 0.67–0.75 s. The cap helps less than expected: with 45 items a day, My Day still holds about 300 items for "This week" and the balance strip. Normal data stays at 87 MB, so no further change is planned unless real use shows otherwise.
- The view-switch render time is not measured automatically yet. Queries and row counts are bounded, as above.
