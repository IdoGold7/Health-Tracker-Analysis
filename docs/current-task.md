# Current Task

## Objective
Add macro progress bars to the Home screen. Show daily intake
against stored targets for kcal, protein, carbs, and fat. Targets
are already persisted in `profiles` by the Settings screen.

## Docs to Read
- `docs/data-model.md` — `profiles` target columns, `food_logs`
  macro query

## Context
The Home screen already computes daily macro totals from `food_logs`
and fetches the user's `profiles` row (including `height_m` for BMI).
This task extends the profiles fetch to include target columns and
renders progress bars comparing intake to targets.

Targets in `profiles`:
- `target_kcal` — always user-entered, independent of weight
- `target_protein_g`, `target_carbs_g`, `target_fat_g` — computed
  from formula in Settings, stored on save. Null if no weight was
  available when Settings was last saved.

**Display rules (agreed):**
- Four rows always visible: Kcal, Protein, Carbs, Fat
- Each row shows: label, intake value, progress bar, target value
- If a target is set → show progress bar (intake / target)
- If a target is null → show intake value only, target shows `-`,
  no progress bar
- If kcal target is set but protein/carbs/fat targets are null →
  kcal row gets a bar, other three show dashes with message:
  "Set your weight to compute macro targets"
- If no targets are set at all → all four rows show intake only,
  no bars, no weight message
- Progress bar can exceed 100% (over-eating is valid data, not an
  error). Visual capping at 100% with a color change (e.g. bar
  turns red/orange when over) is acceptable but not required —
  simplest working version first.

**No new data fetching.** The profiles query already runs on Home.
Just add the target columns to the existing SELECT. Daily totals
query is unchanged.

---

## In Scope

### Checkpoint 1 — Fetch Targets
Update the Home screen's existing `profiles` fetch to also select
`target_kcal`, `target_protein_g`, `target_carbs_g`, `target_fat_g`.
Store them in state.

No new queries. No new useEffect. Just extend the existing one.

**Verification:**
- Console log or inspect state: targets appear when set in profiles
- Targets are null when not set in profiles
- Existing Home screen functionality unchanged (daily totals, BMI,
  Navy BF, food log list, body metrics block)

### Checkpoint 2 — Progress Bars UI
Replace or augment the current daily macro totals display with
progress bar rows.

**Each row contains:**
- Label (Kcal / Protein / Carbs / Fat)
- Intake value (e.g. "1,850" or "142g")
- Progress bar (filled proportionally: intake / target)
- Target value (e.g. "/ 2,500" or "/ 160g")

**When target is null or 0:**
- No progress bar rendered
- Intake always shows the real value (even if 0)
- Target shows `/ -` (e.g. "142g / -")
- A target of `0` is treated as missing, not as a real target
  (prevents division by zero)

**When all macro targets (protein/carbs/fat) are null but kcal
target exists:**
- Show text below the macro rows: "Set your weight to compute
  macro targets"

**When no targets are set at all:**
- No message. Intake values with `/ -` for each target.

**Progress bar implementation:**
- Simple horizontal bar. A container with a filled inner view,
  width = `Math.min(intake / target, 1) * 100%` (capped at 100%
  visually). Only rendered when target is a positive number.
- Default color for under target, different color when
  intake > target (over). Keep it simple — two colors total.
- No animation required.

**Behavior rules:**
- If daily totals are zero (no food logged today), bars show 0%
  fill and intake shows 0. This is valid — not a missing state.
- If targets exist but daily totals query hasn't loaded yet, show
  loading state (same as current behavior).
- Kcal row uses no unit suffix. Protein/carbs/fat rows use "g".
- Use the same number formatting as the existing totals display.

**Developer verifies on device:**
- Targets set (kcal=2500, protein=160, carbs=310, fat=69):
  bars render proportionally to today's intake
- Only kcal target set (protein/carbs/fat null):
  kcal row has bar, other three show intake with `/ -`,
  "Set your weight to compute macro targets" message appears
- No targets set: four rows with intake values and `/ -`, no
  message, no bars
- Over-target: intake exceeds target → bar fills 100% with
  over-target color
- No food logged today: bars at 0%, intake shows 0
- Existing features still work: food log list, body metrics
  block, BMI, Navy BF, navigation links

## Out of Scope
- Dashboard / trends / historical view
- Animated progress bars
- Editing targets from Home (go to Settings)
- Calorie or macro breakdown by food item
- Any changes to Settings screen
- Any schema or migration changes
- UI/UX styling pass beyond basic functional bars

## Flagged
- Nothing currently.

## Completed
*(empty — work has not started)*
