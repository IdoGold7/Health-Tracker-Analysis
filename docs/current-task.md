# Current Task

## Objective
Add a Postgres trigger that automatically creates a `profiles` row
when a new user signs up via Supabase Auth.

Without this, `profiles` has no row for new users and any screen
that reads targets or height will fail silently.

## In Scope
- Trigger function on `auth.users` that inserts into `profiles` on new user creation
- Migration file in `supabase/migrations/`
- Verification that a new signup produces a `profiles` row

## Out of Scope
- Any app-side auth flow (login screen, session handling)
- Any changes to existing tables or RLS policies

## Required Names
- Trigger function: `handle_new_user`
- Trigger: `on_auth_user_created`

Do not deviate from these names.

---

## Migration File
Save as:
`supabase/migrations/YYYYMMDDHHMMSS_create_profile_on_signup.sql`

---

## Required Workflow

### Step 1 — Generate migration
Write the trigger function and trigger.
One migration file. Nothing else.

### Step 2 — Execute migration
Run in Supabase SQL Editor.
If it fails: drop partial objects, fix, retry clean.

### Step 3 — Verify objects exist
Confirm in Supabase:
- trigger function exists
- trigger is attached to `auth.users`

### Step 4 — Verify behavior
Create a test user via Supabase Auth dashboard only (Authentication → Users → Add user).
Do not use SQL insertion into `auth.users` — it bypasses the Auth layer and does not
test the trigger in the correct context.

Confirm a `profiles` row was created for that user with:
- correct `id` (matches `auth.users`)
- `created_at` and `updated_at` set
- all target columns null (expected — no targets set yet)

### Step 4b — Cleanup
Delete the test user from Supabase Auth dashboard (Authentication → Users).
Confirm the `profiles` row is also gone (cascade delete is set on the FK).
If the `profiles` row is orphaned — stop, that's a bug, do not proceed to commit.

### Step 5 — Stop gate
Stop after verification and report results. Do not commit or push.

---

## Completion Standard
Done only when:
1. Migration file exists with correct naming
2. Migration executed cleanly
3. Trigger confirmed to exist on `auth.users`
4. New user signup produces a valid `profiles` row
5. Test user deleted and `profiles` row confirmed gone

## Non-Negotiables
- Never commit or push. Write the migration, verify it, then stop and wait.

---

## Status
- [ ] profile auto-creation trigger

## Flagged
Nothing yet.
