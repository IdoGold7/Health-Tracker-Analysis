# Current Task

## Objective
Body metrics should carry over across days. If the user logged
metrics on Monday and selects Wednesday on the Home screen, Wednesday
shows Monday's values — not dashes. The body metrics entry screen
should also pre-fill with the latest values so the user doesn't have
to re-enter everything from scratch.

## Docs to Read
- `docs/data-model.md` — `body_metrics` table, query patterns

## Context
Currently `fetchLatestBodyMetrics` on the Home screen filters by the
selected day's bounds (`logged_at >= day_start AND logged_at < day_end`).
If no entry exists for that exact day, the panel shows dashes. This is
wrong — a user's weight from Monday is still their weight on Wednesday
until they log a new one.

**New query logic:** fetch the most recent `body_metrics` row where
`logged_at <= end of selected day`, ordered by `logged_at desc`,
limit 1. This returns the latest entry on or before the selected date.

This also enables pre-filling the entry screen — same query gives
you the latest values to populate the inputs.

**Display note:** When the Home screen shows carried-over metrics
(i.e. the entry is from a different day than the selected date),
indicate when it was logged. E.g. show the date next to the block
header so the user knows they're seeing Monday's data on Wednesday,
not data they logged on Wednesday.

---

## In Scope
*(all checkpoints complete — see Completed section below)*

## Out of Scope
- Dirty check / duplicate prevention on save
- Editing existing body metrics entries from this screen
- Any schema or migration changes
- Dashboard integration
- UI/UX styling pass

## Flagged
- Nothing currently.

## Completed

### Checkpoint 1 — Extract Query + Change Logic
Added `fetchLatestBodyMetricsAsOf(selectedDate)` and moved
`BodyMetricsSummary` into `client/lib/body-metrics-helpers.ts`.
Query filters `logged_at < next_day_start`, orders `logged_at desc`,
limit 1 — no lower bound, so metrics carry over across days.
`logged_at` is included in the return type. `client/app/index.tsx`
now imports and uses the shared helper; the local
`fetchLatestBodyMetrics` was removed.

### Checkpoint 2 — Show Entry Date on Home
Added `localDateStr(iso)` helper for local YYYY-MM-DD formatting.
Home compares `localDateStr(bodyMetrics.logged_at)` to
`selectedDate`; when different, appends " (from Apr 20)" to the
Body Metrics block header via
`toLocaleDateString(undefined, { month: 'short', day: 'numeric' })`.
Empty when dates match or no metrics exist.

### Checkpoint 3 — Entry Screen Pre-fill
Added a mount-only `useEffect` in `client/app/body-metrics.tsx`
that calls `fetchLatestBodyMetricsAsOf(selectedDate)` (selected
date comes from the route param) and pre-fills weight, body fat,
neck, waist, forearm from the returned row. `logged_at` is not
pre-filled — `buildLoggedAt` still stamps the insert with current
time. Save path unchanged: always inserts a new row.
