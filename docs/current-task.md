# Current Task

## Objective
Build the food logging screen. User searches for a food, enters an amount,
queues multiple items, and submits — writing all queued items to `food_logs`
with the same `logged_at` timestamp.

## Docs to Read
- `docs/data-model.md` — `food_logs` schema, macro query pattern, unit logic
- `docs/architecture.md` — service boundary, RLS policy matrix
- `docs/ui-principles.md` — if making layout or styling decisions

## In Scope
- New screen: `app/log-food.tsx`
- Search/autocomplete querying both `user_foods` and `public_foods`.
  Each search result must carry its source table and food ID so the insert
  can map to the correct FK: `user_food_id` for user foods,
  `public_food_id` for public foods. Exactly one is set per row —
  see `food_logs` CHECK constraint in `data-model.md`.
- Amount input per item:
  - Food has unit (`unit_label` + `unit_grams` set): default to unit input,
    show unit label. User enters number of units (e.g. 2 eggs).
  - Food has no unit: grams input only.
  - Conversion happens client-side before insert: `units × unit_grams = grams`
  - `food_logs.grams` always stores grams — never units
- Queue: plus button adds item to pending list, user sees all queued items
  before submitting. Queue does not auto-merge — each add action creates a
  separate queued item, even if the same food is added twice.
- `logged_at`: defaults to `now()` at submit. Optional manual override for
  retroactive entry. DB enforces `<= now() + 5 minutes` — surface the error
  if it fires, do not silently swallow it.
- Single submit writes all queued items as separate rows, same `logged_at`
  across all of them. Submit must use a single multi-row insert call —
  row-by-row inserts in a loop are forbidden. If any row fails, the entire
  insert fails and zero rows are written.
- After successful submit: clear the queue, stay on the logging screen,
  show brief confirmation. Do not navigate away.
- Navigation link to this screen from the home screen (`app/index.tsx`)
- Direct Supabase client insert — no Express

## Out of Scope
- Public foods seeding
- Settings / macro targets
- Daily totals display
- Any changes to existing screens beyond the navigation link on home

---

## Build Order and Checkpoints

Build in this order. Stop at each checkpoint, show evidence, wait for approval.

### Checkpoint 1 — Search
Build the search/autocomplete. Show:
- The query code hitting `user_foods` and `public_foods`
- That each result carries source table identity and food ID
- On-device results appearing as you type (developer verifies on device)
- Confirm selecting a food populates the amount input

### Checkpoint 2 — Amount Input
Build the amount input. Show:
- A food with a unit rendering unit input with correct label
- A food without a unit rendering grams input only
- Console log or on-screen output showing the grams value after conversion
  (e.g. 2 eggs → 120g)
- Rejection of zero or negative input before queuing

### Checkpoint 3 — Queue
Build the queue. Show:
- Queued items list after adding 2+ foods (developer verifies on device)
- Correct display: food name, amount entered, grams equivalent
- Adding the same food twice creates two separate queue items
- Submit with empty queue does nothing (show the guard condition in code)

### Checkpoint 4 — Submit + logged_at
Build the submit with both default `now()` and manual time override.
Show:
- The single multi-row insert call (not a loop)
- Rows in Supabase `food_logs` after submitting with default time —
  confirm correct `user_id`, `grams`, `logged_at`, and correct FK column
  (`user_food_id` or `public_food_id`) on each row
- All queued items share the same `logged_at`
- Unit conversion correct in stored row (e.g. 2 eggs = 120g stored)
- A retroactive entry landing in Supabase with a correct custom timestamp
- A future timestamp beyond 5 minutes surfacing an error (show the error)
- Queue clears after successful submit, screen stays on log-food
- Atomicity test: queue 3 items, set `logged_at` to 1 hour in the future
  on the payload before insert, confirm zero rows are written in Supabase

### Checkpoint 5 — RLS
**Manual test — you perform this, not Claude Code.**
Sign in as a second user and test against `food_logs`:
- SELECT: user B sees none of user A's logs
- INSERT: user B cannot insert a row with user A's `user_id`
- UPDATE: user B cannot modify user A's rows
- DELETE: user B cannot delete user A's rows

Claude Code: state that this checkpoint requires manual testing by the
developer and wait for confirmation that it passed.

---

## Completed

All 5 checkpoints passed.

- Checkpoint 1 — Search: dual-table search with source tagging, unit/grams toggle
- Checkpoint 2 — Amount Input: unit conversion, grams display, validation
- Checkpoint 3 — Queue: add/remove items, no auto-merge, empty-queue guard
- Checkpoint 4 — Submit + logged_at: single multi-row insert, manual time override, error surfacing, atomicity
- Checkpoint 5 — RLS: manual test passed by developer

### Files changed
- `client/app/log-food.tsx` — new screen (search, amount, queue, submit)
- `client/app/index.tsx` — added "Log Food" navigation button
