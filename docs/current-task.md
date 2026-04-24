# Current Task

## Objective
Build the Settings screen. Users set height, calorie target, and
target weight. The app computes protein/carbs/fat targets from a
formula and persists all values to `profiles`. Move the height input
from the body metrics entry screen to Settings.

## Docs to Read
- `docs/data-model.md` — `profiles` columns, `body_metrics.weight_kg`

## Context
All columns already exist on `profiles`: `height_m`, `target_kcal`,
`target_weight_kg`, `target_protein_g`, `target_carbs_g`,
`target_fat_g`. No migration needed.

Height is currently entered on the body metrics entry screen and
saved to `profiles.height_m`. This task moves that input to Settings
and removes it from body metrics entry. The data destination
(`profiles.height_m`) does not change — BMI and Navy BF continue
reading from the same column.

**Macro target formula (single formula, no presets):**

```
protein_g = 2 × weight_kg
protein_kcal = protein_g × 4
remaining_kcal = target_kcal - protein_kcal
carbs_g = remaining_kcal × (2/3) / 4
fat_g = remaining_kcal × (1/3) / 9
```

**Weight source for formula:**
- Primary: `profiles.target_weight_kg` (user-set goal weight)
- Fallback: latest `body_metrics.weight_kg` (most recent weigh-in)
- Neither exists → protein/carbs/fat cannot be computed, show dashes

**Computed values are stored, not ephemeral.** When the user saves
Settings, all six values (height_m, target_kcal, target_weight_kg,
target_protein_g, target_carbs_g, target_fat_g) are written to
`profiles`. Home screen reads stored values directly — no
recomputation needed there. If weight changes later, user returns to
Settings and saves again to recompute.

**Behavior rules:**

- **Clearing a field = null.** If a user clears an input and saves,
  that column is written as `null` to `profiles`. Not `0`, not "keep
  old value." This applies to all six fields.
- **Input precision must match DB constraints.**
  `target_kcal` is `integer` — UI accepts whole numbers only. If the
  user enters a decimal, round to nearest integer on save.
  `height_m` is `numeric(4,2)` — max two decimal places.
  `target_weight_kg` is `numeric(5,2)` — max two decimal places.
  Truncate or round extra decimals on save, not while typing.
- **Save button is always enabled** unless a save request is currently
  in flight. Partial data is valid (height only, kcal only, etc.).
  The user can save at any time — the helper handles missing values
  by returning null for computed fields.
- **Invalid typing states don't crash recomputation.** While the user
  is mid-keystroke (e.g. field is empty or contains only "."), the
  computed display shows dashes. The helper receives null for
  unparseable input.

---

## In Scope
*(all checkpoints complete — see Completed section below)*

## Out of Scope
- Progress bars on Home screen (separate task)
- Multiple formula presets (high protein, weight loss, etc.)
- Auto-recalculation when new body_metrics weight is logged
- Any schema or migration changes
- UI/UX styling pass
- Dashboard integration
- Any changes to body metrics detail screen

## Flagged
- README still says "Append-only body metrics. No UPDATE or DELETE"
  under Data Design Decisions — this is stale. Should be updated on
  next README pass.

## Completed

### Checkpoint 1 — Helper Function
Added `calcMacroTargets(target_kcal, weight_kg)` in
`client/lib/macro-target-helpers.ts`. Pure function, null-returning
on invalid/missing inputs or contradictory kcal/protein. Verified
against all cases in spec (case 2 expected values were corrected
mid-task: protein=150, carbs=233, fat=52).

### Checkpoint 2 — Settings Screen
Added `client/app/settings.tsx`. Loads profile + latest
`body_metrics.weight_kg`, edits height/kcal/target weight, live-
computes macros with weight-source indicator, saves all six
`profiles` columns (computed macros written as null when formula
cannot run). Save button disabled only while in flight. No
navigation on success. Added "Settings" button to Home.

### Checkpoint 3 — Remove Height from Body Metrics Entry
Removed height input, state, profile fetch, and the profile-update
step from `client/app/body-metrics.tsx`. Validation and save logic
cleaned up — no dead code. Height reads on Home (BMI, Navy BF)
continue to use `profiles.height_m`; body metrics detail screen
untouched; existing height values preserved.
