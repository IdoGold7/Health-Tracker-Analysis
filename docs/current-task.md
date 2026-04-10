# Current Task: Daily Macro Totals by Selected Day

## Objective
Display computed macro intake for a selected day on the home screen. Default to today. User can open a date picker and select any past date up to today.

## Docs to Read
- `data-model.md` — `food_logs` schema, macro query pattern, FK resolution

## Target File
- `client/app/index.tsx` — existing content (Log Food nav button) stays, new display added alongside it
- Helper logic may live in `client/lib/` only if extraction is clearly needed
- No backend routes, no RPC, no new DB views

## Critical Schema Context
`food_logs` has two nullable FK columns: `user_food_id` and `public_food_id`. Exactly one is set per row (CHECK constraint). Resolve name and per-100g macros using the client query pattern in `data-model.md`. Fetch the linked food record(s) for each `food_logs` row, then normalize each row into a single `DailyLogEntry` using the non-null relation.

## In Scope

**Query:**
- Query `food_logs` for the selected day, joining `user_foods` and `public_foods` to resolve food name and per-100g macros
- Compute per entry:
  - `kcal = grams × kcal_per_100g / 100`
  - `protein_g = grams × protein_per_100g / 100`
  - `carbs_g = grams × carbs_per_100g / 100`
  - `fat_g = grams × fat_per_100g / 100`
- Sum totals across all entries for the selected day
- Direct Supabase query from client — no Express

**Selected day state:**
- Store as a local date-only value (`YYYY-MM-DD`), not as an ISO datetime
- Derive `start` and `end` timestamps from that value in device local time
- `start` = local midnight at start of selected day
- `end` = local midnight at start of next day
- Filter: `logged_at >= start AND logged_at < end`

**Required result shape:**

```ts
type DailyLogEntry = {
  id: string
  logged_at: string
  food_name: string
  grams: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}
```

Normalize fetched rows into `DailyLogEntry[]` before totals calculation and rendering. Sort by `logged_at` desc.

**Display — in this order:**
1. Date picker — defaults to today, `maxDate` = today (no future dates)
2. Totals — kcal, protein, carbs, fat summed
3. Entry list — each row: food name, grams, `logged_at` time, kcal, protein, carbs, fat

**Rounding:**
- kcal: nearest integer
- protein / carbs / fat: 1 decimal place
- Round for display only; calculations use raw values

**Time display:**
- `logged_at` in device local time, format `HH:mm` (24-hour)

**States:**
- Loading: show loading indicator while fetch is in progress
- Error: show error text and log full error to console; totals reset to zero
- Empty: totals show zeroes, list shows "Nothing logged for this day."
- Day switch: do not show previous day's data under the new date label

**Refresh triggers:**
- Screen first mounts
- Selected date changes
- Screen regains focus after returning from another screen
- Focus refetch preserves current selected date — do not reset to today

## Out of Scope
- Targets, progress bars, goal setting
- Settings screen
- Editing or deleting log entries from this screen
- Styling / visual design polish
- Backend routes / Express

---

## Build Order and Checkpoints

### Checkpoint 1 — Query
Build the macro query for a given day. Show:
- Raw query result logged to console with: name, grams, kcal, protein, carbs, fat
- Manual verification of one entry:
  - Note grams and per-100g values from the source food record
  - Calculate: `grams × per_100g / 100`
  - Compare to console output

### Checkpoint 2 — Display
Render date picker, totals, and entry list on home screen. Developer verifies on device:
- Totals equal sum of individual entries
- Food names and grams correct
- Each entry shows time in `HH:mm`
- Ordering is newest first

### Checkpoint 3 — Date Picker
- Select a past date, confirm entries load for that day
- Select today, confirm return
- Future dates not selectable
- Boundary check: entry at 23:59 appears on that day, entry at 00:00 appears on next day

### Checkpoint 4 — Edge Cases
- Day with no logs: zero totals + "Nothing logged for this day."
- Switching between days with and without data works correctly
- Screen opens defaulting to today
- Log a new entry via log-food, return to home — data refreshes
- If selected day is not today, returning from log-food preserves the selected day

---

## Completed

All 4 checkpoints passed.

- Checkpoint 1 — Query: dual-FK embedded select with hint disambiguation, local day bounds, macro computation
- Checkpoint 2 — Display: totals summary, entry list with HH:mm time, rounding, empty/loading/error states
- Checkpoint 3 — Date Picker: @react-native-community/datetimepicker, maxDate=today, triggers refetch on change
- Checkpoint 4 — Edge Cases: empty day zeroes, day switching, default today, focus refetch, selected day preserved

### Files changed
- `client/app/index.tsx` — daily macro query, totals display, entry list, date picker
- `client/package.json` — added @react-native-community/datetimepicker
