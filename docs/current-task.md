# Current Task

## Objective
Compute and render summary stats and adherence counts on the Dashboard
screen. No charts. At the end of this task, the dashboard shows
averages, weight delta, BMI, logging consistency, and per-macro
adherence — all driven by the data-fetching functions built in Task 1.

## Docs to Read
- `docs/data-model.md` — profiles targets, body_metrics columns

## Context
Task 1 delivered:
- `client/app/dashboard.tsx` — date range selector (presets + custom),
  loading indicator, fetches `DailyMacros[]` and
  `BodyMetricsDataPoint[]` via `Promise.all`, stale-request guard,
  profile `height_m` fetched on mount.
- `client/lib/dashboard-queries.ts` — `getDashboardFoodLogs()` and
  `getDashboardBodyMetrics()`.
- `client/lib/dashboard-date-range.ts` — `presetToRange()`, types.

This task adds computation and rendering on top of that foundation.
No new Supabase queries except one small addition (latest weight for
BMI). All other stats are derived from data already in state.

**Critical architecture rule:** Do not store `SummaryStats` or
`AdherenceCounts` in React state. Compute them with `useMemo` from
existing state values (`dailyMacros`, `bodyMetrics`,
`latestWeightKg`, `profile`, `dateRange`). Storing derived values in
state creates stale-data bugs because `setState` is async — the
computation would run against outdated values after a range change.
The correct flow is: fetch → set raw state → `useMemo` derives
stats → render reads derived values.

---

## Definitions

**Averages** — sum of values across days with data, divided by the
number of days with data (not total days in range). Days with no logs
are excluded from the denominator. Example: 30-day range, 20 days
logged → avg kcal = total kcal / 20.

**Weight delta** — difference between last and first weigh-in within
the selected date range. `delta = last_weight - first_weight`. Positive
means gained, negative means lost. Requires at least 2 weigh-ins with
non-null `weight_kg` in range. If fewer than 2, weight delta is `null`.

**Current BMI** — always uses the most recent `weight_kg` entry in the
entire `body_metrics` table (not scoped to date range) and
`profiles.height_m`. Formula: `weight_kg / (height_m ^ 2)`, rounded
to 1 decimal. If either value is missing, BMI is `null`.

**Logging consistency** — `days_logged / total_days_in_range`.
`days_logged` = length of `DailyMacros[]` (already sparse — one entry
per day with data). `total_days_in_range` = number of calendar days
between `dateRange.start` and `dateRange.end`. Display as
`"X / Y days"`.

**Adherence** — per-macro count of days meeting the target:
- `kcal`: days where daily kcal ≤ `target_kcal` (ceiling)
- `protein`: days where daily protein_g ≥ `target_protein_g` (floor)
- `carbs`: days where daily carbs_g ≤ `target_carbs_g` (ceiling)
- `fat`: days where daily fat_g ≤ `target_fat_g` (ceiling)

Each macro's adherence is only computed and displayed when its target
is non-null. If a target is `null`, that macro's adherence row is not
rendered — no placeholder, no message.

---

## In Scope

### Checkpoint 1 — Computation Helpers

Add `client/lib/dashboard-stats.ts`:

```typescript
export type SummaryStats = {
  avg_kcal: number | null;
  avg_protein_g: number | null;
  avg_carbs_g: number | null;
  avg_fat_g: number | null;
  weight_delta_kg: number | null;
  current_bmi: number | null;
  days_logged: number;
  total_days_in_range: number;
};

export type AdherenceCounts = {
  kcal: number | null;      // null when target is null
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export function computeSummaryStats(
  dailyMacros: DailyMacros[],
  bodyMetrics: BodyMetricsDataPoint[],
  latestWeightKg: number | null,
  heightM: number | null,
  totalDaysInRange: number
): SummaryStats

export function computeAdherence(
  dailyMacros: DailyMacros[],
  targets: {
    target_kcal: number | null;
    target_protein_g: number | null;
    target_carbs_g: number | null;
    target_fat_g: number | null;
  }
): AdherenceCounts

export function calcTotalDaysInRange(start: Date, end: Date): number
```

Rules for `computeSummaryStats`:
- If `dailyMacros` is empty, all averages are `null`.
- Averages: sum across all entries, divide by `dailyMacros.length`.
  Round to nearest integer for kcal, 1 decimal for protein/carbs/fat.
- Weight delta: filter `bodyMetrics` for entries where `weight_kg` is
  not null. If fewer than 2 entries, `weight_delta_kg` is `null`.
  Otherwise: `last.weight_kg - first.weight_kg`, rounded to 1 decimal.
  Array is already sorted by `logged_at` ascending (Task 1 guarantee).
- BMI: if `latestWeightKg` and `heightM` are both non-null and > 0,
  compute `latestWeightKg / (heightM ^ 2)`, round to 1 decimal.
  Otherwise `null`.
- `days_logged` = `dailyMacros.length`.
- `total_days_in_range` = passed in directly.

Rules for `computeAdherence`:
- For each macro, if the corresponding target is `null`, the count
  is `null`.
- Otherwise, iterate `dailyMacros` and count days meeting the
  condition (see Definitions above for direction per macro).

Rules for `calcTotalDaysInRange`:
- Difference in calendar days between `start` and `end`.
  Since `end` is exclusive (start of next day), this is:
  `Math.max(0, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY))`.
  `Math.round` handles floating-point drift. `Math.max(0, ...)` prevents
  negative values from bad input. Return as integer.
- Assumes `start` and `end` are already normalized to local
  calendar-day boundaries (00:00:00 local). This is guaranteed by
  `presetToRange` and the custom picker validation from Task 1.

All three functions are pure — no Supabase calls, no side effects.

**Developer verifies** (via console.log in dashboard.tsx, temporary):
- Pass known `DailyMacros[]` → averages match hand calculation
- 2+ weight entries in range → weight delta correct
- 0 or 1 weight entries → weight delta is `null`
- `height_m` null → BMI is `null`
- Both present → BMI matches `weight / height^2`
- Target null for a macro → adherence count is `null` for that macro
- Target set → adherence count correct (check kcal ≤ and protein ≥
  directions specifically)

---

### Checkpoint 2 — Latest Weight Query + Fetch Targets

Add to `client/lib/dashboard-queries.ts`:

```typescript
export async function getLatestWeight(
  supabase: SupabaseClient
): Promise<number | null>
```

Rules:
- Query `body_metrics` where `weight_kg` is not null, ordered by
  `logged_at desc`, limit 1, select only `weight_kg`.
- If no matching rows, return `null`.
- No date range filter — always returns the most recent actual weight
  ever recorded. A body-fat-only entry with null `weight_kg` is
  skipped.
- Returns `null` on error, logs to console.

Update `client/app/dashboard.tsx`:

Define the profile shape explicitly:

```typescript
type DashboardProfile = {
  height_m: number | null;
  target_kcal: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
};
```

- Extend the existing profile fetch to also return `target_kcal`,
  `target_protein_g`, `target_carbs_g`, `target_fat_g`. If the
  existing `fetchProfile` function (or equivalent) already returns
  these from another screen (Home or Settings), reuse it. Do not
  duplicate the query. Store the result as `DashboardProfile` state.
- Add `getLatestWeight` to the mount-time fetch (alongside profile).
  This does NOT re-run on date range changes — only on mount.
- Store `latestWeightKg` in state.
- **Do not store computed stats in state.** Instead, derive them
  with `useMemo`. Use primitive dependencies — `Date` objects and
  profile objects fail referential equality, so extract `.getTime()`
  or individual fields:
  ```typescript
  const totalDays = useMemo(
    () => calcTotalDaysInRange(dateRange.start, dateRange.end),
    [dateRange.start.getTime(), dateRange.end.getTime()]
  );
  const summaryStats = useMemo(
    () => computeSummaryStats(dailyMacros, bodyMetrics, latestWeightKg, profile?.height_m ?? null, totalDays),
    [dailyMacros, bodyMetrics, latestWeightKg, profile?.height_m, totalDays]
  );
  const adherence = useMemo(
    () => computeAdherence(dailyMacros, profile ?? { target_kcal: null, target_protein_g: null, target_carbs_g: null, target_fat_g: null }),
    [dailyMacros, profile?.target_kcal, profile?.target_protein_g, profile?.target_carbs_g, profile?.target_fat_g]
  );
  ```
- `console.log` the `summaryStats` and `adherence` values inside a
  temporary `useEffect` for verification. Remove in Checkpoint 3.
- No rendering yet — verify numbers in console before building UI.

**Developer verifies:**
- Console shows correct summary stats matching the selected range
- Change date range → stats recompute with new data
- BMI uses latest weight (not scoped to range) — change range, BMI
  stays the same
- Targets show in console — match what's set in `profiles`

---

### Checkpoint 3 — Render Stats and Adherence

Update `client/app/dashboard.tsx`:
- Render below the date range selector, above where charts will go
  (Task 3).
- Remove all `console.log` calls from Checkpoints 1 and 2.
- All rendered values come from the `useMemo`-derived `summaryStats`
  and `adherence` objects. Do not read raw query state in JSX.

**Summary stats section — render in this order:**

1. **Average daily intake** — four rows:
   - Avg Kcal: `{avg_kcal}` (integer, no decimal)
   - Avg Protein: `{avg_protein_g}g`
   - Avg Carbs: `{avg_carbs_g}g`
   - Avg Fat: `{avg_fat_g}g`
   - If all averages are `null` (no data in range), show
     `"No food logs in this range"` instead of four null rows.

2. **Weight delta** — single row:
   - If non-null: `"{sign}{weight_delta_kg} kg"` (e.g. `"+1.2 kg"`,
     `"-0.8 kg"`)
   - If null: `"Not enough weigh-ins in range"` (needs ≥ 2)

3. **Current BMI** — single row:
   - If non-null: `"BMI: {current_bmi}"`
   - If null: `"BMI: —"` (em dash, no explanation needed)

4. **Logging consistency** — single row:
   - `"Logged {days_logged} / {total_days_in_range} days"`

**Adherence section — render below summary stats:**
- Title: `"Target Adherence"`
- One row per macro where target is non-null:
  - `"Kcal: {count} / {days_logged} days"`
  - `"Protein: {count} / {days_logged} days"`
  - `"Carbs: {count} / {days_logged} days"`
  - `"Fat: {count} / {days_logged} days"`
- Denominator is `days_logged`, not `total_days_in_range` — you can
  only hit a target on a day you actually logged.
- If all four targets are null, do not render the adherence section
  at all.
- If `days_logged === 0`, do not render the adherence section
  regardless of targets — denominator is zero, counts are meaningless.

**Null / empty state rules:**
- No data in range → summary shows `"No food logs in this range"`,
  weight delta shows its null message, BMI still shows (not scoped
  to range), consistency shows `"Logged 0 / {total} days"`,
  adherence section hidden (`days_logged === 0`).
- Targets all null → adherence section not rendered.
- `days_logged === 0` → adherence section not rendered (regardless
  of targets).
- Loading → existing loading indicator from Task 1 covers this.

**Styling:** functional only. Plain text, readable spacing. No cards,
no colors, no progress bars. Task 3 handles visual treatment. The
goal here is correct numbers on screen.

**Developer verifies:**
- Select a range with known data → all numbers match hand calculation
- Select a range with no data → null states display correctly
- BMI does not change when switching date ranges
- Weight delta shows sign (+/-) correctly
- Adherence: protein counts days ≥ target, others count days ≤ target
- Null target → that adherence row is absent, not blank
- All targets null → entire adherence section hidden
- Rapid range switching → no stale stats displayed (existing guard
  from Task 1 covers this)

---

## Out of Scope
- Charts (Task 3)
- Progress bars or visual treatment of stats
- Settings screen changes
- Macro target computation formulas (already handled in Settings)
- Any schema or migration changes
- Adding dashboard to tabs/nav — already handled by Expo Router

## Flagged
- Nothing currently.

## Completed
- Checkpoint 1 — Date Range State and Selector (Task 1)
- Checkpoint 2 — Food Logs Query (Task 1)
- Checkpoint 3 — Body Metrics Query (Task 1)
- Checkpoint 4 — Wire Dashboard Screen (Task 1)
- Checkpoint 1 — Computation Helpers (Task 2): pure functions computeSummaryStats, computeAdherence, calcTotalDaysInRange in dashboard-stats.ts
- Checkpoint 2 — Latest Weight Query + Fetch Targets (Task 2): getLatestWeight query, DashboardProfile type, profile+weight fetched on mount, useMemo derivations
- Checkpoint 3 — Render Stats and Adherence (Task 2): summary stats and adherence rendered below date selector with full null/empty state handling
