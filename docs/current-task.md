# Current Task

## Objective
Rewrite the `body_metrics` migration file to support UPDATE and DELETE.
This is a migration-only change — no UI work in this task.

## Docs to Read
- `docs/data-model.md` — `body_metrics` section (already updated)

## Context
The `body_metrics` table was originally append-only (no UPDATE, no DELETE).
Architecture decision changed: entries are now editable so users can correct
input errors. Docs (`data-model.md`, `architecture.md`) have already been
updated. This task updates the migration file to match.

## In Scope

### Migration File Rewrite
This table is currently unused and empty, and the project is still in early
development — rewrite the existing create migration instead of adding a new
ALTER migration.

Rewrite `sql/20260407000004_create_body_metrics.sql` to match the updated
schema in `docs/data-model.md`. Changes from the original:
- Add `updated_at timestamptz not null default now()` column
- Add `body_metrics_updated_at` trigger using existing `update_updated_at()` function
- Add UPDATE RLS policy: own rows only
- Add DELETE RLS policy: own rows only
- Keep all existing columns, constraints, CHECK, and index unchanged
- Follow the same naming convention as other migration files
  (see `sql/20260407000003_create_food_logs.sql` for UPDATE/DELETE policy format)

### Checkpoint 1 — Migration File
Show the updated migration file. Developer will:
1. Run `DROP TABLE body_metrics;` in Supabase SQL Editor
2. Paste and run the new migration SQL
3. Verify in Supabase dashboard: table exists, `updated_at` column present,
   all four RLS policies visible
4. Quick smoke test: insert a row, update it (confirm `updated_at` changes),
   delete it

Claude Code: show the file, state what the developer needs to do manually,
and wait for confirmation.

## Out of Scope
- Any UI work
- Any changes to other migration files
- Any changes to docs (already done)

## Completed
*(empty — work has not started)*
