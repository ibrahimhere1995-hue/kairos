# Kairos — The perfect moment to act

Kairos is a **local-first, premium personal planner** for Windows and macOS. It brings tasks, events, goals, and habits from every area of life into one calm, rich, intuitive space, and helps the user act on the right thing at the right moment. All data lives on the user's own machine.

This folder is the complete specification. It is written so an AI coding assistant (or a human developer) can build Kairos from it without guesswork.

## Document set

| # | File | What it answers | Workflow step |
|---|------|-----------------|---------------|
| 1 | `README.md` | What is this, and how to use these files | — |
| 2 | `PRD.md` | What we are building, for whom, and how each feature must behave | 1–4 Idea, Research, User, PRD |
| 3 | `TECH_STACK.md` | Which technologies, and why | 5 Tech stack |
| 4 | `ARCHITECTURE.md` | How the system is structured, data model, data flow | 6 Architecture |
| 5 | `DESIGN_SYSTEM.md` | Brand, colours, fonts, components, UX principles | 7 Design |
| 6 | `PROJECT_RULES.md` | Non-negotiable rules for whoever writes the code | 8 Project rules |
| 7 | `TASKS.md` | Phased, ordered build plan with acceptance criteria | 9 Task breakdown |

## How to use these files with an AI coding assistant

1. Put this whole folder in the root of the project repository as `/docs`.
2. Copy `PROJECT_RULES.md` to the repo root as `CLAUDE.md` (or `AGENTS.md` / `.cursorrules`, depending on the tool). Most AI coding tools read that file automatically on every session.
3. Start every work session with a prompt like:
   > Read `/docs/PRD.md`, `/docs/ARCHITECTURE.md`, `/docs/DESIGN_SYSTEM.md` and `/docs/TASKS.md`. Implement task **P1-T03** only. Follow `CLAUDE.md`. When done, tick the task in `TASKS.md` and summarise what changed.
4. **One task at a time.** Review, run the app, test it yourself, then move to the next task. Never ask the AI to "build the whole app".
5. When a decision changes, update the relevant document first, then the code. The documents are the source of truth.

## Product at a glance

- **Name:** Kairos (Greek: the opportune, decisive moment to act)
- **Tagline:** *The perfect moment to act.*
- **Platform:** Desktop app (Windows + macOS), offline-first; mobile is a later phase
- **Stack:** Tauri 2 + React + TypeScript + SQLite
- **Lead user:** the busy multi-hat professional whose job, learning, and home life collide in one calendar
- **Positioning:** Fully local. Your data stays with you. Premium feel, zero learning curve.
- **Look:** Rich interface, light and dark themes, deep midnight base with a warm gold accent

## Workflow status (18-step process)

| Step | Status |
|------|--------|
| 1 Idea | ✅ Done |
| 2 Research | 🟡 Feature research done; competitor deep-dive still open (see PRD §11) |
| 3 Define the user | ✅ Done |
| 4 PRD | ✅ This set |
| 5 Tech stack | ✅ This set |
| 6 Architecture | ✅ This set |
| 7 Design | ✅ Design system defined; visual mockups still to be produced |
| 8 Project rules | ✅ This set |
| 9 Task breakdown | ✅ This set |
| 10 Setup → 18 Monitoring | ⏳ Pending (see `TASKS.md`) |

Adapted steps for a local desktop app: **15 Preview deployment** = beta build installed on own machines; **17 Production deploy** = signed installers for Windows and macOS; **18 Monitoring** = opt-in crash reports and update checks only.
