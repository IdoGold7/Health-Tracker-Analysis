# Current Task

## Objective
Build the Supabase database schema for this project.
Deliver all required tables with:
- constraints
- indexes
- RLS policies
- required triggers

## In Scope
- profiles
- public_foods
- user_foods
- food_logs
- body_metrics

## Required Table Order
1. profiles
2. public_foods
3. user_foods
4. food_logs
5. body_metrics

Do not change the order.

## Dependency Notes
- profiles depends on auth.users only
- public_foods has no table dependencies
- user_foods depends on public_foods and auth.users
- food_logs depends on user_foods and public_foods
- body_metrics depends on auth.users only

---

## Execution Rules

Work on one table only.

For the current table only, Claude must produce:
1. the SQL migration
2. a short verification checklist
3. the exact commit message

After that, Claude must stop.

Claude must not:
- generate SQL for the next table
- discuss the next table in detail
- batch multiple tables into one migration
- mark a table complete without explicit confirmation that execution, verification, and commit are finished

---

## Required Workflow For Each Table

### Step 1 — Generate migration
Claude writes the SQL for one table only.
Save the SQL as a migration file under:
`supabase/migrations/`
Filename format:
`YYYYMMDDHHMMSS_create_<table_name>.sql`
No combined migration files. One table per migration.

### Step 2 — Execute migration
Run the migration in the Supabase SQL editor.
If execution fails:
- stop immediately
- inspect the failure
- drop any partially created objects for that table before retrying
- do not re-run the migration on top of a partial state

A failed attempt must be cleaned up before the next attempt.

### Step 3 — Verify database objects
Confirm all required objects exist for the current table:
- table
- primary key
- foreign keys
- unique constraints
- check constraints
- indexes
- RLS enablement
- RLS policies
- triggers

Do not assume correctness because the migration executed successfully.

### Step 4 — Verify behavior
Test actual behavior for the current table.
Required checks:
- valid inserts are accepted
- invalid inserts are rejected
- constraints behave as defined
- triggers fire as intended
- RLS behaves as intended

### Step 5 — RLS validation
RLS must be tested with two different authenticated users.
Required proof:
- user A can access permitted rows
- user A cannot read user B's protected rows
- user A cannot write user B's protected rows
- user B is tested separately

Testing as only one authenticated user is not sufficient.
A table with user-scoped access is not verified until cross-user isolation is proven.

### Step 6 — Fix loop
If any execution or verification step fails:
- return to Claude for a fix for the same table only
- do not proceed to the next table
- do not commit

### Step 7 — Commit
Commit only after the current table:
- executed successfully
- was fully verified
- passed RLS testing where applicable

Commit both:
- the migration file
- any related required changes for that table

Commit message format:
`feat: add <table_name> table with RLS and constraints`

Do not amend old migrations that were already committed. New fixes must be made in a new migration unless explicitly instructed otherwise.

### Step 8 — Stop gate
After commit, stop and wait.
Claude may proceed only after receiving explicit confirmation that the current table was:
- executed successfully
- verified successfully
- committed successfully

---

## Completion Standard
A table is complete only when all of the following are true:
1. migration file exists in the correct path with the correct naming format
2. migration executed cleanly
3. partial-state cleanup was done if any prior run failed
4. constraints were verified by behavior, not assumption
5. indexes were confirmed
6. RLS was enabled and policies were confirmed
7. triggers were confirmed
8. cross-user RLS testing passed where applicable
9. commit was created with the required message

If any one of these is missing, the table is not complete.

---

## Status
- [x] profiles
- [x] public_foods
- [x] user_foods
- [ ] food_logs
- [ ] body_metrics

## Flagged
Nothing yet.
