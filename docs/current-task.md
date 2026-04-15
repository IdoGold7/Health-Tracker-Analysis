# Current Task

## Objective
Add a log detail screen where the user can view, edit, or delete an existing
food log entry. Tapping a log entry on the home screen navigates to the
detail screen.

## Docs to Read
- `docs/data-model.md` — `food_logs` schema, editable columns, delete behavior
- `docs/architecture.md` — RLS policy matrix (UPDATE + DELETE on `food_logs`)

## In Scope

### Navigation
- Each log entry on the home screen (`app/index.tsx`) becomes tappable
- Tapping navigates to a new detail screen: `app/log/[id].tsx`
- The log entry ID is passed as a route parameter

### Detail Screen — Read-Only View (default state)
- Fetches the full log entry by ID, joined to `user_foods` / `public_foods`
  for food name and per-100g macros
- Displays: food name, grams, logged_at (formatted), computed kcal,
  protein, carbs, fat
- All fields read-only by default
- Two actions visible: "Edit" button and "Delete" button
- If the query returns no data (not found, RLS blocked, invalid route
  param, network error): show a simple error message and a back button.
  Do not render edit/delete controls against an empty state.

### Edit Mode
- User taps "Edit" → grams and logged_at become editable inputs,
  all other fields stay read-only
- Grams input: pre-filled with current value
- Logged_at input: pre-filled with current value, user can change it
  (same manual override pattern as log-food)
- Food name: displayed as read-only label — never editable
- "Save" button replaces "Edit" button. "Cancel" returns to read-only
  view without saving.

### Save (Update)
- Supabase client UPDATE on the row by `id`
- Updates `grams` and `logged_at` only
- Same constraints apply:
  - `grams > 0` — validate client-side before sending
  - `logged_at <= now() + 5 minutes` — DB enforces, surface error if it fires
- On success: call `router.back()` to return to home screen. Home screen
  refetches on focus, so totals and list update automatically.
- On failure: stay on detail screen, show error, re-enable Save button
- While save request is in flight: disable Save and Delete buttons to
  prevent duplicate submissions. Re-enable on failure.

### Delete
- User taps "Delete" → confirmation prompt ("Delete this entry?")
- On confirm: Supabase client DELETE on the row by `id`
- While delete request is in flight: disable Save and Delete buttons to
  prevent duplicate submissions
- On success: call `router.back()` to return to home screen
- On cancel: dismiss prompt, stay on detail screen

### Direct Supabase client operations — no Express

## Out of Scope
- Changing the food source (`user_food_id` / `public_food_id`) on an existing
  log. Documented scope cut: if the user logged the wrong food, they delete
  the entry and re-log through the existing log-food screen. Future path:
  extract food search into a shared `<FoodPicker />` component, then reuse
  it in the edit flow.
- Batch edit or batch delete
- Undo / soft delete
- Any changes to `log-food.tsx`
- Styling polish

## Scope Cut Note (for docs/README)
Food source is not editable on an existing log entry. This is a deliberate
MVP scope cut — not a technical limitation. The food search and source-tagging
logic in `log-food.tsx` would be extracted into a shared component
(`components/FoodPicker.tsx`) and reused in the edit flow. Delete + re-log
is the workaround until then.

---

## Build Order and Checkpoints

### Checkpoint 1 — Query Extraction + Navigation + Detail Screen (Read-Only)

**Query extraction (do first):**
- Extract the food_logs select+join query from `app/index.tsx` into a
  shared function in `client/lib/queries.ts`
- The function returns `supabase.from('food_logs').select(...)` with
  joins and column aliases only. No filters, no sorting, no `.single()`,
  no `await`, no response mapping. Callers chain their own filters onto the return
  value (.gte/.lt for date range, .eq/.single for one entry).
- Replace the inline query in `app/index.tsx` with a call to the shared
  function. Verify home screen still works — same data, same behavior.
- **Boundary: do not change anything else in `index.tsx`.** No renaming,
  no restructuring, no touching rendering logic. Swap the query, confirm
  it works, stop.
- **Wait for developer confirmation that the home screen still works before building the detail screen.**

**Then build the detail screen:**
- Make log entries tappable on the home screen
- Tapping navigates to `app/log/[id].tsx`
- Detail screen uses the same shared query function with `.eq('id', id).single()`
- Displays: food name, grams, logged_at, computed macros
- Data matches what the home screen showed for that entry

Show:
- The shared query function in `client/lib/queries.ts`
- Home screen still renders correctly after the swap (developer verifies)
- Detail screen renders correct data for a tapped entry (developer verifies)

### Checkpoint 2 — Edit Mode + Save
Build the edit toggle and save action. Show:
- Tapping "Edit" switches grams and logged_at to editable inputs,
  food name stays read-only
- "Cancel" returns to read-only view without firing any update
- After saving edited grams: row in Supabase reflects new value,
  returning to home shows updated totals
- After saving edited logged_at: row in Supabase reflects new timestamp
- Rejection of zero or negative grams (show the guard or error)
- A future timestamp beyond 5 minutes surfacing an error from the DB
- On successful save: navigates back to home

### Checkpoint 3 — Delete
Wire up the delete action. Show:
- Confirmation prompt appears before delete
- After confirming: row is removed from Supabase, navigates back to home,
  entry gone from list, totals updated
- Cancelling the prompt does nothing — stays on detail screen

### Checkpoint 4 — RLS
**Manual test — developer performs this, not Claude Code.**
Sign in as a second user and test against `food_logs`:
- SELECT: user B navigates directly to `/log/{user-A-entry-id}` —
  detail screen should show error/not-found, not user A's data
- UPDATE: user B cannot modify user A's rows
- DELETE: user B cannot delete user A's rows

Claude Code: state that this checkpoint requires manual testing by the
developer and wait for confirmation that it passed.

---

## Completed

- **Checkpoint 1** — Query extraction (`client/lib/queries.ts`), navigation (tappable log entries), detail screen read-only view (`client/app/log/[id].tsx`)
- **Checkpoint 2** — Edit mode toggle, save with client-side and DB-enforced validation
- **Checkpoint 3** — Delete with confirmation prompt
- **Checkpoint 4** — RLS manually verified: SELECT, UPDATE, DELETE all blocked for non-owner
