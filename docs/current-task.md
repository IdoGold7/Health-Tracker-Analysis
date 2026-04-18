markdown# Current Task

## Objective
Add edit and delete for existing `body_metrics` entries via a new detail
screen reached from the Home screen body metrics block.

## Docs to Read
- `docs/data-model.md` — `body_metrics` section (editable fields, RLS)
- `docs/architecture.md` — screen list, data flow

## Context
Body metrics entries are currently insert-only from the app. Correcting
a mistyped value creates a duplicate row; only the latest shows on Home
(ordered by `logged_at desc, created_at desc`). Clean dataset is the
project's primary goal, so the correction path must actually UPDATE or
DELETE rows, not append over them.

Database already supports this — the `body_metrics` migration added
UPDATE and DELETE RLS policies in a prior task. This is UI-only work.

Scope boundary: this task edits **one** entry at a time — the latest
entry for the selected date on Home. Older same-date duplicates are
reachable only via the Supabase dashboard until a body metrics history
screen exists. Documented, intentional.

## In Scope

### Checkpoint 1 — Shared Helpers Extraction
Before writing the detail screen, extract shared logic from
`client/app/body-metrics.tsx` into a new file
`client/lib/body-metrics-helpers.ts`.

Extract the following pure functions (no component state, no hooks):
- `parsePositive(value: string): number | null`
- `parseBodyFat(value: string): number | null`
- `buildLoggedAt(selectedDate: string): string` — the "today → now(),
  past date → local noon" construction
- `todayStr(): string` — already exists, move it too

The existing entry screen must import these from the new file after
extraction. No behavior change on the entry screen — this is
mechanical refactor only.

**Developer verifies on device:**
- Body metrics entry screen still works end-to-end (one submit test
  with valid input, one test with invalid input showing the inline
  error)
- No TypeScript errors, no runtime errors

### Checkpoint 2 — Detail Screen + Routing
New route: `client/app/body-metrics-detail.tsx`.

**Routing:**
- `fetchLatestBodyMetrics` in `client/app/index.tsx` must be extended
  to include `id` in its select and return shape. Update
  `BodyMetricsSummary` type accordingly.
- The Home screen body metrics block becomes tappable **only when
  there is a row for the selected date** (i.e. `bodyMetrics != null`).
  Use conditional rendering: `<TouchableOpacity>` when there's data,
  plain `<View>` when empty. Do not always-render a tappable wrapper
  with logic inside.
- On tap, route to `/body-metrics-detail?id=<row id>`.

**Screen structure:**
- Same five body metric fields as the entry screen (pre-filled from
  the fetched row), importing shared helpers from Checkpoint 1
- Date picker pre-filled with the row's `logged_at` date
- No height section
- Save button, Delete button, Back link to Home

**Route param handling:**
- Missing `id` query param → error state rendered on the screen, no
  Supabase call
- Fetch error or row not found → error state with return-to-Home option

**On mount:**
- Show loading indicator while fetching
- Fetch the row by `id` (RLS scopes to current user — a user cannot
  retrieve another user's row regardless of id)
- Populate all fields from the fetched row
- If row does not exist (deleted elsewhere, stale id, or RLS-filtered),
  show "Entry not found" error state with return-to-Home button

**Validation:** identical rules to the entry screen, using shared
helpers:
- `body_fat_pct` — `>= 0 and <= 100`
- Other numerics — `> 0`
- Empty strings normalize to `null`
- At least one of the five metric fields must be non-null after edit
- Non-numeric input blocks submit

**Save behavior:**
- Disable Save button while request is in flight
- Call `supabase.from('body_metrics').update({ ... }).eq('id', id).select()`
  (the `.select()` returns affected rows so we can count them)
- **Verify exactly one row was updated.** If zero rows affected, show
  "Entry no longer available — it may have been deleted" error, offer
  return to Home. Do not navigate as if success.
- On one row updated: navigate back to Home. Home refetches on focus.
- On error: surface message, stay on screen, re-enable Save, do not
  clear fields

**Delete behavior:**
- Confirm dialog: "Delete this check-in? This cannot be undone."
- Disable Delete button while request is in flight
- On confirm: `supabase.from('body_metrics').delete().eq('id', id).select()`
- **Verify exactly one row was deleted.** Zero rows affected → same
  error flow as Save.
- On success: navigate back to Home
- On cancel or error: stay on screen

**Developer verifies on device:**
- Home body metrics block with data → tappable → detail screen opens
  with fields pre-filled
- Home body metrics block with all `-` → not tappable
- Edit a single field, save → Home reflects new value; Supabase shows
  the row was updated (same id, new values, `updated_at` changed)
- Edit `logged_at` to a different past date, save → Home no longer
  shows this entry on the original date; shows it on the new date
- Delete → confirm → row is gone from Supabase; Home shows all `-` (or
  an older same-date row if duplicates existed)
- Delete → cancel → nothing happens
- Save button disabled during in-flight request (rapid double-tap does
  not cause two updates — check Supabase row count)
- Delete button disabled during in-flight request
- Validation: empty all five fields → save blocked; zero/negative/
  out-of-range → save blocked
- Future date not selectable
- Missing id in URL → error state, no Supabase call visible in
  network tab

### Checkpoint 3 — RLS + Affected-Row Verification
Manual two-user test:
- User A: log a body metrics entry, copy the row `id` from Supabase
- User A: edit and save → confirm row updated (correct row, correct user)
- User A: log another entry; copy that id too
- User B: attempt to navigate directly to
  `/body-metrics-detail?id=<A's row id>` → expected: fetch returns no
  row (RLS filters), "Entry not found" error state shows

**Stale-id tests:**
- Open detail screen in one session (tab 1); delete the row in Supabase
  dashboard; attempt Save in tab 1 → expected: "Entry no longer
  available" error (zero rows affected)
- Same setup but attempt Delete in tab 1 → expected: same error

## Out of Scope
- Body metrics history / list view (deferred to Dashboard task)
- Editing older same-date duplicates (Supabase dashboard fallback)
- Success toast on save/delete (polish, later)
- Visual affordance on tappable Home block (chevron, etc. — polish, later)
- Unsaved-changes warning on back navigation
- UUID format validation on the id route param (Supabase will reject
  malformed queries; cost not worth it)
- Any changes to the entry screen beyond the helpers extraction
- Any changes to food logging
- Any schema or migration changes
- Charts / trends / BMI history

## Flagged
- Nothing currently.

## Completed

### Checkpoint 1 — Shared Helpers Extraction
Extracted `todayStr`, `parsePositive`, `parseBodyFat`, `buildLoggedAt` into shared module. Entry screen and Home screen import from shared file.
- `client/lib/body-metrics-helpers.ts` (new)
- `client/app/body-metrics.tsx` (removed inline helpers, imports from shared file)
- `client/app/index.tsx` (removed duplicate `todayStr`, imports from shared file)

### Checkpoint 2 — Detail Screen + Routing
Edit/delete detail screen with pre-filled fields, validation via shared helpers, affected-row verification on save/delete, confirm dialog on delete. Home body metrics block conditionally tappable.
- `client/app/body-metrics-detail.tsx` (new)
- `client/app/index.tsx` (added `id` to BodyMetricsSummary type/query, conditional TouchableOpacity vs View)

### Checkpoint 3 — RLS + Affected-Row Verification
Verification-only: confirmed cross-user RLS isolation on detail screen fetch, stale-id save/delete returns zero-rows-affected error. No files changed.