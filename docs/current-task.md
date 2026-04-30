# Current Task

## Objective
Build the foundation for the Dashboard screen: a working date range
selector and all data-fetching functions. No charts, no rendered stats.
At the end of this task, the screen exists, the date range selector
works, and running the queries logs correct data to the console.
Everything in Task 2 and Task 3 depends on this.

## Docs to Read
- `docs/architecture.md` — service boundary, data flow
- `docs/data-model.md` — food_logs query pattern, body_metrics columns, profiles

## Context
`client/app/dashboard.tsx` does not exist yet. This task creates it.

The queries need to join food_logs → user_foods / public_foods to
compute macros per row, then aggregate per calendar day in JavaScript.
Raw log volume for 30–90 days is small (hundreds of rows at most) —
client-side aggregation is the right call, not a DB function.

The date range is device-local, same pattern as the Home screen.
`start` is the start of the first day at 00:00:00 local,
`end` is the start of the day after the last day at 00:00:00 local
(exclusive upper bound, consistent with food_logs query pattern).

---

## In Scope

### Checkpoint 1 — Date Range State and Selector

Add `client/lib/dashboard-date-range.ts`:

```typescript
export type Preset = '7d' | '30d' | '90d' | '365d';

export type DateRange = {
  start: Date;   // 00:00:00 local time on the first day
  end: Date;     // 00:00:00 local time on the day after the last day
  preset: Preset | 'custom';
};

export function presetToRange(preset: Preset, now = new Date()): DateRange
```

Rules:
- `now` defaults to `new Date()`. Accepts an override so the function
  is testable without mocking system time.
- `presetToRange('30d')` → start = 29 days before `now` at 00:00
  local, end = tomorrow at 00:00 local (so today is always included,
  and the window covers exactly 30 calendar days).
- Same logic for 7d (6 days before today), 90d, 365d.
- No external side effects beyond reading `now`.

Update `client/app/dashboard.tsx`:
- State: `dateRange`, default `presetToRange('30d')`
- UI: horizontal row of four preset buttons (7d / 30d / 90d / 365d).
  Active preset is visually distinct. Tapping a preset calls
  `presetToRange` and updates `dateRange`.
- Custom picker: two `DateTimePicker` inputs (start date, end date).
  Use the same `DateTimePicker` package already used elsewhere in the
  app. Do not introduce a new date picker dependency unless none
  exists in the project.
  Shown below preset row. When both are set, `dateRange.preset` is
  `'custom'`. Custom range `end` is always the start of the day after
  the selected end date (exclusive), same convention as presets.
  If custom start is after custom end, ignore the update and keep the
  previous valid `dateRange`. Do not fetch with an invalid range.
- No data fetching yet. `console.log` the active `dateRange` whenever
  it changes to confirm the dates are correct.

**Developer verifies:**
- Tap 7d → logs a range covering exactly 7 calendar days
- Tap 30d → logs a range covering exactly 30 calendar days
- Set a custom start and end → logs a range matching the selections
- Today is always included in preset ranges
- Set custom start after custom end → range does not update, previous
  valid range is preserved

---

### Checkpoint 2 — Food Logs Query

If a local-date helper (converting a `Date` or ISO timestamp to a
device-local `'YYYY-MM-DD'` string) does not already exist in the
codebase, create it in `client/lib/date-helpers.ts` and use it here.
Do not duplicate this logic inline or across files.

Add to `client/lib/dashboard-queries.ts`:

```typescript
export type DailyMacros = {
  date: string;          // 'YYYY-MM-DD' in device-local time
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  log_count: number;     // number of individual log entries that day
};

export async function getDashboardFoodLogs(
  supabase: SupabaseClient,
  start: Date,
  end: Date
): Promise<DailyMacros[]>
```

Rules:
- Query `food_logs` with `logged_at >= start.toISOString()` and
  `logged_at < end.toISOString()`.
- Select: `logged_at`, `grams`, and nested selects for
  `user_foods(kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)`
  and `public_foods(kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)`.
- For each row, pick the non-null food source (exactly one will be
  set, guaranteed by DB constraint). Compute raw macro values:
  `rawKcal = (kcal_per_100g * grams) / 100`. Do NOT round per row.
- Convert `logged_at` to device-local date string (`'YYYY-MM-DD'`)
  using the shared helper for grouping.
- Group rows by local date string. Sum raw values per day.
  Round the final daily totals to 1 decimal place.
  Count rows per day as `log_count`.
- Return array sorted by date ascending. Days with no logs are not
  included (sparse — callers handle gaps).
- Returns empty array if no logs in range. Never throws — catch
  Supabase errors, log to console, return `[]`.

**Developer verifies:**
- Range covering days with known logs → correct daily totals
- Range with no logs → empty array returned, no crash
- Range spanning a day boundary → entries on each side of midnight
  grouped to their correct local date

---

### Checkpoint 3 — Body Metrics Query

Add to `client/lib/dashboard-queries.ts`:

```typescript
export type BodyMetricsDataPoint = {
  date: string;                // 'YYYY-MM-DD' device-local
  logged_at: string;           // full ISO string, for chart x-axis precision
  weight_kg: number | null;
  body_fat_pct: number | null;
  neck_cm: number | null;
  waist_cm: number | null;
  forearm_cm: number | null;
  navy_bf_pct: number | null;  // computed via calcNavyBodyFat
};

export async function getDashboardBodyMetrics(
  supabase: SupabaseClient,
  start: Date,
  end: Date,
  height_m: number | null
): Promise<BodyMetricsDataPoint[]>
```

Rules:
- Query `body_metrics` with `logged_at >= start.toISOString()` and
  `logged_at < end.toISOString()`.
- Select `logged_at`, `weight_kg`, `body_fat_pct`, `neck_cm`,
  `waist_cm`, `forearm_cm`.
- For each row, call `calcNavyBodyFat(neck_cm, waist_cm, height_m)`
  from `client/lib/body-metrics-helpers.ts` (already exists).
- Convert `logged_at` to device-local date string using the shared
  helper for the `date` field.
- Return array sorted by `logged_at` ascending.
- Multiple entries on the same calendar day are all included — do not
  deduplicate. Chart and stat layers decide how to handle this.
- Returns empty array on error, same pattern as Checkpoint 2.

**Developer verifies:**
- Range with known body metric entries → correct rows returned
- Entry with neck + waist + valid height_m → `navy_bf_pct` populated
- Entry missing neck or waist → `navy_bf_pct` is `null`
- `height_m = null` passed in → `navy_bf_pct` is `null` for all rows

---

### Checkpoint 4 — Wire Dashboard Screen

Update `client/app/dashboard.tsx`:
- Fetch profile to get `height_m`. If a hook or query function for
  this already exists (from Settings or Home), use it. Do not
  duplicate it. Fetch only `height_m` — targets are not used in
  Task 1. Profile is fetched once on mount, not re-fetched on date
  range changes.
- Once `height_m` is available (may be `null`), call both
  `getDashboardFoodLogs` and `getDashboardBodyMetrics` in parallel
  with `Promise.all` on mount and whenever `dateRange` changes.
- Guard against stale async results: use an `isCancelled` flag in
  `useEffect` cleanup. Only the response from the latest request
  should update state or write console logs. Discard results from
  superseded requests silently.
- Show a loading indicator while fetching.
- `console.log` the results: daily macro array and body metrics array.
- No rendering of data beyond the date range selector and loading
  indicator — foundation only.

**Developer verifies:**
- Change preset → loading indicator appears → new data logged to
  console
- Set custom range → correct data for that range logged
- Empty range (no data in range) → empty arrays logged, no crash
- Change range quickly (simulate rapid preset taps) → only the last
  request's result appears in console, no stale overwrites
- `height_m` from profile correctly passed to body metrics query

---

## Out of Scope
- Charts (Task 3)
- Summary stats and adherence rendering (Task 2)
- Profile targets (not needed until Task 2)
- Adding `dashboard.tsx` to the tabs or nav UI — creating the file is
  in scope, wiring it into navigation is not. Expo Router exposes the
  file automatically by filename; no nav change is needed to reach it
  during development.
- Any schema or migration changes

## Flagged
- Nothing currently.

## Completed
- Checkpoint 1 — Date Range State and Selector
- Checkpoint 2 — Food Logs Query
- Checkpoint 3 — Body Metrics Query
- Checkpoint 4 — Wire Dashboard Screen
