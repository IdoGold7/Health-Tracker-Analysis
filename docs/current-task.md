# Current Task

## Objective
Display Navy body fat % estimate on the Home screen body metrics block,
computed from existing data (`neck_cm`, `waist_cm` from `body_metrics`,
`height_m` from `profiles`). Shown alongside the manual `body_fat_pct`
value — not replacing it.

## Docs to Read
- `docs/data-model.md` — `body_metrics` columns, `profiles.height_m`

## Context
Circumference columns (`neck_cm`, `waist_cm`) were added to
`body_metrics` specifically to support this calculation. The data is
already being collected. This task adds the display-only computation.

The US Navy body fat formula (male) is:

```
body_fat_% = 86.010 × log10(waist_cm - neck_cm) - 70.041 × log10(height_cm) + 36.76
```

Where `height_cm = height_m × 100`.

This follows the same non-persisted derived-metric pattern as BMI, but
the calculation happens locally in the app via a helper function, not
in the database query. No query changes, no schema changes.

Hardcoded to male formula — gender selection is out of scope
(documented, intentional, portfolio project with single user).

## In Scope

### Checkpoint 1 — Helper Function
Add to `client/lib/body-metrics-helpers.ts`:

```typescript
/**
 * US Navy body fat % estimate (male formula).
 * Returns null if any input is missing or invalid.
 */
export function calcNavyBodyFat(
  neck_cm: number | null,
  waist_cm: number | null,
  height_m: number | null
): number | null
```

Rules:
- If any of the three inputs is `null`, return `null`
- If `height_m <= 0` or `neck_cm <= 0` or `waist_cm <= 0`, return
  `null`
- If `waist_cm <= neck_cm`, return `null` (formula produces
  nonsensical output — log of zero or negative)
- Convert `height_m` to cm: `height_m × 100`
- Apply formula: `86.010 × log10(waist - neck) - 70.041 × log10(height_cm) + 36.76`
- Return a `number | null`, already rounded to one decimal place.
  The UI renders the returned number directly and must not apply
  additional rounding or formatting logic.
- If the computed result is not finite (`NaN`, `Infinity`, `-Infinity`),
  return `null`
- Pure function, no side effects, no Supabase calls

**Verification:** Developer runs the function mentally or in a
scratch file with known values:
- neck=38, waist=85, height=1.78 → expected ≈ 18.6%
- neck=null → returns null
- waist=30, neck=35 (waist < neck) → returns null
- height=0 → returns null
- neck=0 → returns null

### Checkpoint 2 — Home Screen Display
Update the body metrics block in `client/app/index.tsx`.

**Data available:** `bodyMetrics` already has `neck_cm`, `waist_cm`,
`body_fat_pct`. `heightM` is already fetched from `profiles`.

**Compute once before render:** Call `calcNavyBodyFat` once with
`bodyMetrics?.neck_cm`, `bodyMetrics?.waist_cm`, `heightM` and store
the result. Use the same derived value in both tappable and
non-tappable render variants. Do not duplicate calculation logic
inline across branches.

**Display change:** Add Navy estimate to the body metrics summary.
Current display has:
```
Weight: X kg | Body fat: X% | BMI: X
Neck: X cm | Waist: X cm | Forearm: X cm
```

New display:
```
Weight: X kg | Body fat: X% | BMI: X
Navy BF: X% | Neck: X cm | Waist: X cm | Forearm: X cm
```

Rules:
- If result is `null`, show `Navy BF: -`
- If result is a number, show `Navy BF: X%` using the returned value
  directly (no additional rounding)
- Import `calcNavyBodyFat` from helpers
- Non-tappable variant: `Navy BF: -` (same as other missing values)

**No changes to:**
- Body metrics entry screen
- Body metrics detail screen
- Any database queries or schema
- The manual `body_fat_pct` field or display

**Developer verifies on device:**
- Entry with neck=38, waist=85, height=1.78 → Navy BF shows ≈ 18.6%
- Entry with only weight (no neck or waist) → Navy BF shows `-`
- Entry with neck and waist but no height set in profiles → Navy BF
  shows `-`
- No data for selected date → entire block shows dashes including
  Navy BF
- Manual body fat % still displays independently alongside Navy BF

## Out of Scope
- Female formula / gender selection
- Storing Navy BF in the database
- Showing Navy BF on detail or entry screens
- Forearm in the formula (Navy method uses neck + waist only)
- Any changes to body metrics entry or detail screens
- Any schema or migration changes

## Flagged
- Nothing currently.

## Completed
*(empty — work has not started)*
