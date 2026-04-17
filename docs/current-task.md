# Current Task

## Objective
Build the body metrics entry flow: a new screen to log check-ins and
manage profile height, plus integrate the latest entry into the Home
screen display.

## Docs to Read
- `docs/data-model.md` — `body_metrics` and `profiles` sections (BMI query pattern)
- `docs/architecture.md` — screen list, data flow

## Context
The previous task rewrote the `body_metrics` migration to support UPDATE
and DELETE. Table schema is now final. This task is the first UI build
on top of it: entry screen + Home display. Edit/delete of existing
entries is a later task, following the same pattern as food logs.

Height lives on `profiles.height_m`, not on `body_metrics`. It is needed
for BMI. The entry screen exposes a height input that writes to
`profiles` — no schema change.

## In Scope

### Checkpoint 1 — Body Metrics Entry Screen
New route: `client/app/body-metrics.tsx`.

Form fields:
- `weight_kg` (optional)
- `body_fat_pct` (optional)
- `neck_cm`, `waist_cm`, `forearm_cm` (optional)
- `height_m` (optional) — separate section; writes to `profiles`
- Date picker — date only, no hour input visible

**Validation (client-side, mirrors schema CHECK):**
- `body_fat_pct` — must be `>= 0 and <= 100`
- `weight_kg`, `neck_cm`, `waist_cm`, `forearm_cm`, `height_m` — must be `> 0`
- Empty input strings (`""`) must be normalized to `null` before any
  request. Do not send `""` to Supabase — NOT NULL and CHECK constraints
  will fire with confusing errors.
- Non-numeric parse failures block submit before any request is sent
- Future dates are not selectable

**Submit rules:**

1. Determine intent based on form state:
   - Body metric fields non-empty → `body_metrics` insert is intended
   - Height changed vs current `profiles.height_m` (including clearing
     to null) → `profiles` update is intended
   - Neither → submit is disabled

2. `logged_at` construction from selected date:
   - Today → `now()`
   - Past date → local noon of that date (avoids the 5-min future check)

3. Write order and failure handling:
   - If `body_metrics` insert is intended, run it first
     - On failure: surface error, stop, do not touch `profiles`
   - If `profiles` height update is intended, run it after (or alone, if
     no body metric fields were filled)
     - On failure after a successful `body_metrics` insert: show
       "Check-in saved, height was not updated — please retry." Refetch
       both resources so UI matches server truth. No silent partial success.
     - On failure when no body_metrics insert ran: standard error, retry.

4. Height-only submission is allowed. If all five body metric fields are
   empty but `height_m` changed, skip the `body_metrics` insert and only
   update `profiles.height_m`.

5. Clearing the height field writes `null` to `profiles.height_m`. This
   is intentional — BMI will then render as `-` across all dates until
   height is re-entered.

Nav:
- Add "body metrics" link to Home alongside the existing 4 nav links

**Developer verifies on device:**
- Body-metric-only submit: inserts row, does not touch profile
- Height-only submit: updates profile, inserts no body_metrics row
- Combined submit: both writes succeed in order
- Clearing height writes null; BMI on Home goes to `-` everywhere
- Validation rejects: empty submit, zero/negative for `> 0` fields,
  `body_fat_pct` outside 0–100, non-numeric input
- Future date cannot be picked
- Empty-string normalization: type a value then clear → field submits
  as `null`, not `""`

### Checkpoint 2 — Home Screen Body Metrics Summary
Modify `client/app/index.tsx`.

**Data requirement:**
- Latest `body_metrics` row for the **selected local date**
- Current `profiles.height_m` for BMI

**Query rule — local day boundaries (same pattern as the daily macro totals query):**

```sql
where user_id = auth.uid()
  and logged_at >= :local_day_start
  and logged_at <  :local_day_end
order by logged_at desc, created_at desc
limit 1
```

The `created_at desc` secondary sort is a deterministic tie-breaker —
two past-date check-ins written on the same date both get
`logged_at = local noon`, so insertion order decides which is "latest."

Follow the documented BMI join pattern in `data-model.md`. Don't invent
a different fetch shape.

**Stale response handling:** use the same pattern already in place for
the daily macro totals query on this screen. If the selected date
changes mid-fetch, stale results must not overwrite newer ones.

**Display position:** under the date picker, above the macro totals.

**Display content:**
- `weight_kg`, `body_fat_pct`, `neck_cm`, `waist_cm`, `forearm_cm` —
  null fields render as `-`
- Values display raw as stored, no unit conversion
- BMI — `round(weight_kg / power(height_m, 2), 1)`
  - If `weight_kg` is null OR `height_m` is null → `-`
- No body_metrics row for the selected date → all fields render as `-`

**Decision (flag if you disagree):** if a user has multiple check-ins on
the same date, Home shows only the latest. Listing multiple per day is
a future task if it ever becomes a real use case.

**Developer verifies on device:**
- Date with a check-in shows values
- Date without a check-in shows all `-`
- Clearing height in profile makes BMI show `-` on every date; other
  fields unaffected
- Switching date refreshes both metrics and macros
- Rapid date switching: no stale values from the wrong day leak into
  the display
- Same-date tie-break: two past-date check-ins with identical
  `logged_at` — the one inserted later wins

### Checkpoint 3 — RLS + Edge Cases
Manual two-user test:
- User A inserts a `body_metrics` row; User B cannot SELECT or UPDATE it
- User A's height update does not affect User B's profile row
- Confirm via Supabase dashboard and in-app state for both users

Edge cases:
- Unauthenticated request to insert is rejected
- Rapid date switching does not leak values from the wrong day
  (covered by stale-response pattern in Checkpoint 2)
- Empty submit (no body metric fields, height unchanged) is blocked
  before any request fires
- Non-numeric input rejected cleanly
- Form with all five metric fields empty AND unchanged height cannot submit

## Out of Scope
- Edit or delete of existing body_metrics entries (separate task, same pattern as food log edit)
- Charts, trends, or history view for body metrics (Dashboard task)
- BMI category labels ("healthy", "overweight") — just the number or `-`
- Any schema or migration changes
- Any changes to food logging
- True atomicity of the two-write submit (would need a server-side RPC — deferred)

## Flagged
- Nothing currently.

## Completed

### Checkpoint 1 — Body Metrics Entry Screen
Entry form with date picker, five body metric fields, separate height section writing to `profiles`, client-side validation, two-step submit with partial-failure handling, and inline validation message above Save button.
- `client/app/body-metrics.tsx` (new)
- `client/app/index.tsx` (added "Body Metrics" nav link)