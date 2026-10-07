> **Project location (chosen by Zack, 2026-10-06):** `I:\Claude Projects\Kairos`
> All project files, builds, and caches live inside this folder. Nothing goes on C: without explicit approval.
> Dev toolchain (Rust, pnpm, C++ Build Tools) lives in `I:\DevTools`. Unavoidable on C:: Windows SDK + VS Installer (approved 2026-10-07).
> **Dev app data** (WebView cache, `kairos.db`, backups) goes in `I:\Claude Projects\Kairos\.devdata` (git-ignored) during development; release builds use the normal OS app-data folder (approved 2026-10-07).
# Kairos — Project Rules (copy to repo root as CLAUDE.md / AGENTS.md)

You are building **Kairos**, a local-first premium personal planner (Tauri 2 + React + TypeScript + Rust + SQLite). Tagline: *The perfect moment to act.*

## Source of truth
- Read before any work: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/TASKS.md`.
- If the code and docs disagree, **stop and ask**. Do not silently invent requirements.
- Work on **one task ID from `TASKS.md` at a time**. When finished: tick it, list files changed, and note anything left undone.

## Workspace location (ask first)
- **Before creating any project files, folders, or installing anything, ask the user which drive and folder to build in** (e.g. `D:\Projects\kairos`). Do not assume the C: drive or the user's home folder.
- Once the user answers, create, edit, and build files **only inside that folder**. Record the chosen path at the top of this file.
- Never create files, folders, or caches on the C: drive unless the user explicitly approves it.
- If a tool wants to install or cache something outside the chosen location (Rust toolchain, Cargo/pnpm caches, build output), **stop and ask the user** where it should go. Suggest moving it with `RUSTUP_HOME`, `CARGO_HOME`, `CARGO_TARGET_DIR`, and `pnpm config set store-dir`.

## Absolute rules (never break)
1. **Never lose user data.** All writes in transactions. Deletes are soft (Trash). Migrations back up the DB first. Never run destructive SQL without a backup.
2. **Local-first.** No network calls except: AI (only when user enabled + key set), update check (toggleable), crash reports (opt-in). No analytics, no remote fonts/scripts/images.
3. **Frontend never touches SQL or the internet.** All data and network go through Tauri commands in Rust.
4. **No secrets in code, DB, logs, or exports.** API keys live in the OS keychain only.
5. **Every feature works offline** except the AI features, which fail gracefully with a friendly message.
6. **Accessibility is not optional.** Keyboard reachable, visible focus, accessible names, AA contrast, icon + text labels, reduce-motion respected.
7. **Use design tokens only.** No raw hex colours, px font sizes, or ad-hoc shadows in components.
8. **All user-facing text goes through i18n** (`t('key')`). No hard-coded strings in JSX.
9. **Plain, kind language** per DESIGN_SYSTEM §1. Missed items are "slipped", amber, never red, never scolding.

## Code standards

### TypeScript / React
- `strict: true`; no `any` (use `unknown` + narrowing). No `@ts-ignore` without a comment explaining why.
- Function components + hooks only. One component per file; file names `PascalCase.tsx` for components, `camelCase.ts` otherwise.
- Feature-folder structure (`src/features/<feature>/`). Shared primitives only in `src/components/ui`.
- Data fetching via TanStack Query hooks in `features/<x>/api.ts`; never call `invoke` directly from components — use `src/lib/api`.
- Zustand only for UI state; server data lives in Query cache.
- Forms: React Hook Form + Zod schemas co-located with the feature.
- Dates: always `date-fns`; store/transport UTC ISO strings; format with the user's locale/timezone in the UI only.
- No component over ~250 lines — split it.

### Rust
- Layers: `commands` (thin, validate) → `services` (logic) → `repo` (SQL only). No SQL outside `repo`.
- Use parameterised queries only. Never build SQL with string formatting of user input.
- Return `Result<T, AppError>`; no `unwrap()`/`expect()` outside tests and startup-fatal paths.
- `cargo clippy -- -D warnings` and `cargo fmt` must pass.
- Long work (backups, AI calls, imports) runs async and never blocks the UI.

### Database
- Every schema change is a new numbered migration; never edit an applied migration.
- IDs UUID v7; timestamps UTC ISO-8601; `created_at`/`updated_at`/`deleted_at` on every table.
- Status is computed, never stored.

## Testing
- Pure logic (status rules, NL parsing, recurrence, reminders' next fire time, backup retention) **must** have unit tests covering normal, edge, and timezone/DST cases.
- Each Rust service function: unit tests with an in-memory SQLite.
- Each new screen: at least one React Testing Library test for its main interaction.
- Critical paths have E2E tests: create task, complete + undo, reschedule missed, backup + restore.
- All tests pass before a task is considered done.

## UI checklist for every screen/component
- [ ] Works in light and dark themes
- [ ] Works at all 4 text sizes and at window width 960 px
- [ ] Keyboard-only usable; focus visible; Esc closes overlays
- [ ] Has loading (skeleton), empty, and error states
- [ ] Destructive actions undoable or in Trash
- [ ] Icons have labels or tooltips + `aria-label`
- [ ] Strings in i18n file

## Git & workflow
- Branch per task: `feat/P1-T03-calendar-week-view`.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Small commits; never commit generated binaries, `.env`, keys, or `kairos.db`.
- Update docs in the same change when behaviour changes.

## Performance budgets
- Cold start < 2 s; view switch < 150 ms; installer < 20 MB; idle RAM < 150 MB.
- Lists over 200 rows are virtualised.
- Calendar queries are range-bounded (never "load all items").

## Dependencies
- Do not add libraries, crates, or tools not listed in `TECH_STACK.md` without asking.
- When one is approved, **update `docs/TECH_STACK.md` (what, version, why) in the same PR**. Installed tools, paths, env vars and dev quirks go in `docs/SETUP.md`.

## When unsure
Ask a short question rather than guessing. Prefer the simpler solution that matches the docs.
