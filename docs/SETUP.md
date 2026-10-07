# Kairos — Developer Setup Guide

How this machine is set up to build Kairos, and how to repeat it on another one.
**Update this file in the same PR whenever a tool, path, or setting changes.**

## 1. Where everything lives

| What | Location |
|------|----------|
| Project | `I:\Claude Projects\Kairos` |
| Specs | `docs\` (this folder) |
| Rules for AI assistants | `CLAUDE.md` (copy of `docs\PROJECT_RULES.md` + chosen paths) |
| Dev toolchain | `I:\DevTools\` (see below) |
| Dev app data: database, backups, WebView cache | `I:\Claude Projects\Kairos\.devdata\` (git-ignored) |
| Release app data (installed app only) | OS app-data folder, e.g. `%APPDATA%\com.kairos.app` |
| GitHub | https://github.com/ibrahimhere1995-hue/kairos (private) |

Rule: nothing goes on the C: drive without approval. The only approved exceptions are listed in §3.

## 2. Tools (Windows)

| Tool | Version at setup | Installed to | How it was installed |
|------|------------------|--------------|----------------------|
| Node.js | 24.x LTS | `C:\Program Files\nodejs` (pre-existing) | nodejs.org installer |
| Git | 2.55 | `C:\Program Files\Git` (pre-existing) | git-scm.com |
| WebView2 | built into Windows 11 | system | — |
| pnpm | 12.9.1 | `I:\DevTools\npm-global` | `npm install -g pnpm --prefix I:\DevTools\npm-global` |
| Rust (stable, MSVC) | 1.99 | `I:\DevTools\rustup` + `I:\DevTools\cargo` | `rustup-init.exe -y` with the env vars below set first |
| C++ Build Tools (VS 2022, "Desktop development with C++") | 17.x | `I:\DevTools\VSBuildTools` | `vs_BuildTools.exe --installPath I:\DevTools\VSBuildTools --path cache=I:\DevTools\VSCache --path shared=I:\DevTools\VSShared --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended` |

Installers are kept in `I:\DevTools\installers\`.

**Why the C++ Build Tools?** On Windows, Rust uses Microsoft's linker (`link.exe`) and the Windows SDK to produce `.exe` files. Tauri officially requires them; the GNU toolchain alternative is not supported.

### Environment variables (User scope)
| Variable | Value |
|----------|-------|
| `RUSTUP_HOME` | `I:\DevTools\rustup` |
| `CARGO_HOME` | `I:\DevTools\cargo` |
| `Path` (added) | `I:\DevTools\cargo\bin`, `I:\DevTools\npm-global` |

Package caches are also kept on I:
- `npm config set cache I:\DevTools\npm-cache`
- `pnpm config set store-dir I:\DevTools\pnpm-store`

After changing environment variables, **restart VS Code** (and any terminal) so it sees them.

## 3. Approved exceptions on C: (2026-10-07)
Windows does not let these move:
- Windows SDK (~1.7 GB) in `C:\Program Files (x86)\Windows Kits`
- Visual Studio Installer (~125 MB) and its settings in `C:\ProgramData\Microsoft\VisualStudio`
- Tiny config files: `%USERPROFILE%\.npmrc` and pnpm's `rc` file

## 4. Everyday commands (run in the project folder)

| Command | What it does |
|---------|--------------|
| `pnpm install` | Install frontend dependencies (exact versions from the lockfile) |
| `pnpm tauri dev` | Run the app in development mode (hot reload) |
| `pnpm test` | Frontend unit tests (Vitest) |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Code quality |
| `pnpm test:rust` / `pnpm lint:rust` / `pnpm fmt:rust` | Rust tests, clippy, rustfmt |
| `pnpm build` | Production frontend build |

**Generated types:** `src/types/*.ts` are generated from Rust structs by `ts-rs` whenever `pnpm test:rust` runs (settings in `.cargo/config.toml` at the repo root). After changing a Rust type that the frontend uses, run `pnpm test:rust` and commit the updated files. CI fails if they are out of date. Never edit them by hand.

Dev-only page: **Styleguide** in the sidebar (`/dev/styleguide`) shows every colour, type size and button in both themes.

## 5. Workflow
1. One task from `docs/TASKS.md` per branch: `feat/P1-T05-...`.
2. When done: tests pass locally, task ticked in `TASKS.md`, branch pushed.
3. Open the pull request on GitHub, wait for **All checks have passed** (Windows + macOS), then **Merge pull request** (merge commit, not squash).
4. Any new library or tool → add it to `docs/TECH_STACK.md` (and this file for tools) **in the same PR**.

### Why CI is sometimes slow
CI builds the whole Rust side on fresh Windows and macOS machines. After a change to `Cargo.toml`/`Cargo.lock` (new crates) the build cache doesn't match, so everything recompiles. That includes Tauri and SQLite's C source, which takes **~10–20 minutes**. Runs after that reuse the cache and take a few minutes. macOS machines can also sit in GitHub's queue for a while ("Queued"). Docs-only changes still run CI in full.

## 6. Known dev-mode quirks
| Symptom | Cause | Fix |
|---------|-------|-----|
| Blank window right after new npm packages were added | Vite re-bundles dependencies while the window is loading | Close the app and run `pnpm tauri dev` again |
| `file watcher error: EBUSY … .devdata\webview` | Vite watching the WebView cache | Fixed: `.devdata` is ignored in `vite.config.ts` |
| Old `C:\Users\<you>\AppData\Local\com.kairos.app` folder | WebView cache from before dev data moved to `.devdata` | Safe to delete |
| PowerShell breaks a `git commit -m` message containing double quotes | PowerShell 5.1 argument quoting | Write the message to a file and use `git commit -F <file>` |
| Types appear in `src-tauri/bindings/` instead of `src/types/` | Cargo didn't find `.cargo/config.toml` | It must stay at the **repo root** (Cargo searches from the current folder upwards) |
| `Blocking waiting for file lock on build directory` | A running `pnpm tauri dev` is rebuilding at the same time | Wait, or close the dev app first |

## 7. Inspecting the dev database
The dev database is `.devdata\kairos.db` (SQLite, WAL mode). Any SQLite viewer works, e.g. *DB Browser for SQLite*. Open it **read-only** while the app is running.
