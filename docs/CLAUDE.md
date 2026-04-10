# CLAUDE.md

Personal Health Data Platform. Food logging, macro tracking, body metrics. Portfolio project.

**Stack:** React Native (Expo) · Supabase (PostgreSQL + Auth + RLS)

---

## Start Here

1. Read `docs/current-task.md` — this is your scope. Do not go beyond it.
2. Read the minimum docs the task requires — usually one, sometimes two (e.g. architecture + data-model for schema work, workflow + quality for a new feature). Do not read all of them.
3. Follow `docs/workflow.md` for how to work. Follow `docs/quality.md` for when you're done.

---

## Key Docs

| Doc | Read when |
|---|---|
| `docs/architecture.md` | Stack, folder structure, data flow, service boundary |
| `docs/data-model.md` | Schema, table relationships, constraints, query patterns |
| `docs/workflow.md` | How to work: task scope, commits, branching |
| `docs/quality.md` | Definition of done, test checklist |
| `docs/ui-principles.md` | UI work only |
| `docs/export.md` | Export feature only |
| `docs/current-task.md` | Every session — defines scope |

---

## Non-Negotiables

- Direct Supabase CRUD from the client for user-owned data
- RLS is the security boundary — never bypass it
- One task at a time. Write → test → move on. No refactoring mid-task.
- Do not read files outside the current task scope
- Never commit or push without explicit approval. Write the code, test it, then stop and wait. Do not run `git commit` or `git push` unless told to.
- Do not duplicate logic. If the same operation exists elsewhere in the codebase, extract it into a shared function and call it from both places. If extraction isn't clean, flag it — do not copy-paste and move on.
- At each checkpoint: paste the relevant code, show actual output (console log, Supabase query result, or CLI output). State expected vs actual result. Explicitly state which checkpoint this is. Do not self-report "it works" — show evidence. If a checkpoint requires visual confirmation on a device, state what the developer should verify and wait for confirmation. Wait for explicit approval before continuing.
