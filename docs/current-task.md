# Current Task

## Objective
Build food library CRUD against `user_foods`. Direct Supabase client — no Express.

## Routes
- `client/app/index.tsx` — auth screen; "Go to Library" button renders only when session exists
- `client/app/library.tsx` — list + search user foods
- `client/app/add-food.tsx` — create a new food
- `client/app/food/[id].tsx` — view, edit, delete a single food

## Field Rules
| Field | Required | Rule |
|---|---|---|
| name | Yes | Non-empty after trim |
| brand | No | Null if empty |
| kcal_per_100g | Yes | Decimal >= 0, 1 decimal place max |
| protein_per_100g | Yes | Decimal >= 0, 1 decimal place max |
| carbs_per_100g | Yes | Decimal >= 0, 1 decimal place max |
| fat_per_100g | Yes | Decimal >= 0, 1 decimal place max |
| unit_label | No | Both unit fields or neither |
| unit_grams | No | Decimal > 0, 1 decimal place max |

Empty string on any numeric field = validation error, not null coercion.

## Validation
**Client enforces:**
- Name non-empty after trim
- All numeric inputs are valid numbers (not empty string, not NaN)

**Database enforces (already in schema — no new migrations):**
- `name not null`
- macros `>= 0` (check constraints)
- `numeric(6,1)` — 1 decimal place max enforced by column type
- `unit_grams > 0` (check constraint)
- Unit both-or-neither (check constraint)

**Not enforced at DB level:**
- Trimmed non-empty name — client only. A space-only name will pass the DB.

## Search Behavior
- Case-insensitive substring match on `name` only
- Client-side filter against already-fetched results

## Library Sort Order
- Default: alphabetical by `name`, ascending
- Sort applied after client-side search filter

## Delete Behavior
- Confirm before attempting delete
- On FK violation from Supabase (Postgres error 23503), catch by error code and show:
  "This food cannot be deleted because it has been logged. Remove the logs first."
- Raw Postgres/Supabase error must never reach the screen
- On success, navigate back to library

## Edit Behavior
- All fields editable except `id`, `user_id`, `created_at`, `source_public_food_id`
- After successful save, refetch from DB and display updated values
- No optimistic UI

## RLS Verification
- Unauthenticated SELECT → rejected
- Unauthenticated INSERT → rejected
- Unauthenticated UPDATE → rejected (note: UPDATE requires SELECT policy to work correctly in Supabase RLS)
- Unauthenticated DELETE → rejected
- User A cannot read or modify User B's rows (test with two accounts)

## Definition of Done
**Completed: 2026-04-07**
- [x] Add a food → appears in library, sorted alphabetically
- [x] Edit macros → change reflected after save and refetch
- [x] Delete food with no logs → succeeds, removed from library
- [x] Delete food referenced by a log → shows exact error message, raw error not visible
- [x] Search filters correctly, case-insensitive, substring match on name
- [x] All field validation rules enforced on submit
- [x] All four RLS operations verified unauthenticated
- [x] Two-user RLS isolation verified
- [x] "Go to Library" only visible when session exists on index.tsx