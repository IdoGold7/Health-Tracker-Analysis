# Data Model

## Overview

Five core tables. Everything in the app reads from or writes to these.

| Table | Purpose |
|---|---|
| `profiles` | User-owned settings: macro targets and height |
| `public_foods` | Seed food library — read-only, shared across all users |
| `user_foods` | User's personal food library — private, RLS-enforced |
| `food_logs` | Every log entry — timestamped, unstructured, no meal concept |
| `body_metrics` | Periodic check-ins: weight, body fat %, circumferences |

> `auth.users` is managed by Supabase Auth and is not listed here. `profiles` extends it.
> A log entry references either `public_foods` or `user_foods` — never both, never neither.

---

## `profiles`

One row per user. Extends `auth.users`.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | No | — | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `target_kcal` | `integer` | Yes | `null` | Daily calorie target. Check: `>= 0` |
| `target_protein_g` | `integer` | Yes | `null` | Daily protein target (g). Check: `>= 0` |
| `target_carbs_g` | `integer` | Yes | `null` | Daily carbs target (g). Check: `>= 0` |
| `target_fat_g` | `integer` | Yes | `null` | Daily fat target (g). Check: `>= 0` |
| `height_m` | `numeric(4,2)` | Yes | `null` | User height in meters. Check: `> 0`. Used for BMI calculation. |
| `target_weight_kg` | `numeric(5,2)` | Yes | `null` | Target weight in kg for dynamic macro computation. Check: `> 0` |
| `created_at` | `timestamptz` | No | `now()` | Auto-set on insert |
| `updated_at` | `timestamptz` | No | `now()` | Auto-updated via trigger |

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  target_kcal integer check (target_kcal >= 0),
  target_protein_g integer check (target_protein_g >= 0),
  target_carbs_g integer check (target_carbs_g >= 0),
  target_fat_g integer check (target_fat_g >= 0),
  height_m numeric(4,2) check (height_m > 0),
  target_weight_kg numeric(5,2) check (target_weight_kg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- reusable trigger function (used by all tables)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
before update on profiles
for each row execute function update_updated_at();

-- auto-create a profiles row when a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
```

**Decisions:**
- Targets are nullable — user can exist before setting them. UI shows no progress bars until targets are set.
- No weight here — it is time-series data and lives in `body_metrics`.
- `height_m` lives here because it is effectively stable for an adult and needed for BMI derivation at query time.
- `target_weight_kg` is used for dynamic macro target computation (protein = 2 × target_weight_kg; remaining kcal split 2:1 carbs-to-fat by calories). Falls back to latest `body_metrics.weight_kg` if not set. Stored on `profiles` because it is a user-chosen goal, not a measurement.
- Integer for all targets — no decimal macro targets needed for MVP.
- `ON DELETE CASCADE` on the FK to `auth.users` — deleting a user removes their profile. Without this, auth user deletion is blocked or leaves an orphaned row.
- Profile row is created automatically via `on_auth_user_created` trigger on `auth.users`. The app never inserts into `profiles` directly on signup.
- RLS: user can only read and write their own row.

---

## `public_foods`

The seed food library. Populated once from Open Food Facts. Read-only for all users — no user owns these rows.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | PK |
| `name` | `text` | No | — | Display name |
| `brand` | `text` | Yes | `null` | Optional brand name |
| `kcal_per_100g` | `numeric(6,1)` | No | — | Check: `>= 0` |
| `protein_per_100g` | `numeric(6,1)` | No | — | Check: `>= 0` |
| `carbs_per_100g` | `numeric(6,1)` | No | — | Check: `>= 0` |
| `fat_per_100g` | `numeric(6,1)` | No | — | Check: `>= 0` |
| `unit_label` | `text` | Yes | `null` | Unit name |
| `unit_grams` | `numeric(6,1)` | Yes | `null` | Grams per unit. Check: `> 0` |
| `created_at` | `timestamptz` | No | `now()` | Auto-set on insert |

```sql
create table public_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  kcal_per_100g numeric(6,1) not null check (kcal_per_100g >= 0),
  protein_per_100g numeric(6,1) not null check (protein_per_100g >= 0),
  carbs_per_100g numeric(6,1) not null check (carbs_per_100g >= 0),
  fat_per_100g numeric(6,1) not null check (fat_per_100g >= 0),
  unit_label text,
  unit_grams numeric(6,1) check (unit_grams > 0),
  check (
    (unit_label is null and unit_grams is null) or
    (unit_label is not null and unit_grams is not null)
  ),
  created_at timestamptz not null default now()
);

create index on public_foods (name);
```

**Decisions:**
- No `user_id` — rows are shared. RLS: all authenticated users can SELECT, nobody can INSERT/UPDATE/DELETE.
- No `updated_at` — seed data is not updated in place. Schema changes to public data are migrations, not user operations.
- No user-editable unit preset here. If a user wants a custom unit for a public food, the app copies the food into `user_foods` and the user edits their copy.

---

## `user_foods`

The user's personal food library. One row per food item.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | No | — | FK → `auth.users(id)` |
| `name` | `text` | No | — | Display name, e.g. "Cottage Cheese" |
| `brand` | `text` | Yes | `null` | Optional brand name |
| `kcal_per_100g` | `numeric(6,1)` | No | — | Check: `>= 0` |
| `protein_per_100g` | `numeric(6,1)` | No | — | Check: `>= 0` |
| `carbs_per_100g` | `numeric(6,1)` | No | — | Check: `>= 0` |
| `fat_per_100g` | `numeric(6,1)` | No | — | Check: `>= 0` |
| `unit_label` | `text` | Yes | `null` | Unit name, e.g. "egg", "cup", "bottle" |
| `unit_grams` | `numeric(6,1)` | Yes | `null` | Grams per one unit. Check: `> 0` |
| `source_public_food_id` | `uuid` | Yes | `null` | FK → `public_foods(id)`. Set if this row was copied from seed data. Null for user-created foods. |
| `created_at` | `timestamptz` | No | `now()` | Auto-set on insert |
| `updated_at` | `timestamptz` | No | `now()` | Auto-updated via trigger |

```sql
create table user_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  brand text,
  kcal_per_100g numeric(6,1) not null check (kcal_per_100g >= 0),
  protein_per_100g numeric(6,1) not null check (protein_per_100g >= 0),
  carbs_per_100g numeric(6,1) not null check (carbs_per_100g >= 0),
  fat_per_100g numeric(6,1) not null check (fat_per_100g >= 0),
  unit_label text,
  unit_grams numeric(6,1) check (unit_grams > 0),
  source_public_food_id uuid references public_foods(id),
  -- source_public_food_id is set when a row is copied from public_foods; null for user-created foods.
  -- copied rows are permanently detached — changes to the public source do not propagate.
  check (
    (unit_label is null and unit_grams is null) or
    (unit_label is not null and unit_grams is not null)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_foods_updated_at
before update on user_foods
for each row execute function update_updated_at();

-- composite unique enables FK ownership enforcement from food_logs
alter table user_foods add unique (id, user_id);

create index on user_foods (user_id, name);
create index on user_foods (source_public_food_id); -- supports "find user's copy of this public food"

-- prevents duplicate copies of the same public food per user
create unique index on user_foods (user_id, source_public_food_id)
  where source_public_food_id is not null;
```

**Unit examples:**

| Food | unit_label | unit_grams |
|---|---|---|
| Egg | "egg" | 60 |
| Cottage cheese | "cup" | 200 |
| Milk | "bottle" | 500 |
| Chicken breast | null | null |

**Logging flow:**
1. User logs a food — grams are always required.
2. If logging a public food for the first time with a custom unit, the app copies it into `user_foods` and stores the unit there. Subsequent logs of that food use the `user_foods` copy.
3. During logging, user can optionally set a unit (label + grams). This writes back to `user_foods`, overriding any previous unit.
4. Next time the user logs that food, the unit is pre-filled as a convenience shortcut.
5. `food_logs` always stores grams — never the unit. The unit lives on `user_foods` only.

**Decisions:**
- All macro columns are `not null` — a food with unknown macros has no place in a macro tracker.
- `numeric(6,1)` — one decimal place covers real-world nutrition labels without false precision.
- One unit per food, two flat columns — simpler than JSONB, queryable, covers all real use cases.
- Unit is optional and set during logging, not at food creation. Override replaces the previous unit entirely.
- Unit constraint: either both `unit_label` and `unit_grams` are set, or neither is.
- Delete behavior: restricted — a food cannot be deleted if logs reference it. Historical data is preserved.
- RLS: user can only read and write their own rows.
- `source_public_food_id` — nullable FK to `public_foods`. Records provenance when a row was copied from seed data. After copying, the row is permanently detached: edits to the user's copy do not affect the public source, and changes to the public source do not propagate back. If sync or re-import is needed in the future, this column enables finding which public food a user row originated from. Null for all user-created foods.
- A partial unique index on `(user_id, source_public_food_id) where source_public_food_id is not null` prevents duplicate copies of the same public food per user. App logic performs upsert-or-fetch, but the DB enforces the invariant regardless.

**Known limitation:**
Macros are calculated from `user_foods` (or `public_foods`) at query time, so correcting a food's values retroactively affects all historical logs. This is intentional for input errors. If a product's real-world nutritional values change, historical logs will reflect the new values. Accepted trade-off for a personal tracker at MVP scale.

---

## `food_logs`

Every consumption event. One row per log entry.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | No | — | FK → `auth.users(id)` |
| `user_food_id` | `uuid` | Yes | `null` | FK → `user_foods(id)`. Null if logging a public food. |
| `public_food_id` | `uuid` | Yes | `null` | FK → `public_foods(id)`. Null if logging a personal food. |
| `grams` | `numeric(6,1)` | No | — | Actual amount consumed. Check: `> 0` |
| `logged_at` | `timestamptz` | No | — | Client-owned. Check: `<= now() + 5 min` |
| `created_at` | `timestamptz` | No | `now()` | Auto-set on insert |

```sql
create table food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  user_food_id uuid references user_foods(id),
  public_food_id uuid references public_foods(id),
  -- composite FK ensures user_food_id belongs to this user (public_food_id has no owner)
  foreign key (user_food_id, user_id) references user_foods (id, user_id),
  -- exactly one food source must be set
  check (
    (user_food_id is not null and public_food_id is null) or
    (user_food_id is null and public_food_id is not null)
  ),
  grams numeric(6,1) not null check (grams > 0),
  -- note: time-based CHECK works for MVP; migrate to trigger before production
  logged_at timestamptz not null check (logged_at <= now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);

-- indexes
create index on food_logs (user_id, logged_at desc);
create index on food_logs (user_food_id);
create index on food_logs (public_food_id);
```

**Example rows:**

| user_food_id | public_food_id | grams | logged_at |
|---|---|---|---|
| uuid-abc | null | 200.0 | 2026-04-06 08:30+03 |
| null | uuid-xyz | 60.0 | 2026-04-06 08:30+03 |
| uuid-def | null | 150.0 | 2026-04-06 13:15+03 |

**Macro calculation** (done at query time, never stored):

```sql
-- client sends local day boundaries as ISO timestamps
-- e.g. day_start = '2026-04-06T00:00:00+03:00', day_end = '2026-04-07T00:00:00+03:00'
select
  coalesce(uf.name, pf.name)                                          as name,
  fl.grams,
  round(coalesce(uf.kcal_per_100g,    pf.kcal_per_100g)    * fl.grams / 100, 1) as kcal,
  round(coalesce(uf.protein_per_100g, pf.protein_per_100g) * fl.grams / 100, 1) as protein_g,
  round(coalesce(uf.carbs_per_100g,   pf.carbs_per_100g)   * fl.grams / 100, 1) as carbs_g,
  round(coalesce(uf.fat_per_100g,     pf.fat_per_100g)     * fl.grams / 100, 1) as fat_g
from food_logs fl
left join user_foods  uf on uf.id = fl.user_food_id
left join public_foods pf on pf.id = fl.public_food_id
where fl.user_id = auth.uid()
  and fl.logged_at >= :day_start
  and fl.logged_at <  :day_end;
```

**Decisions:**
- `grams > 0` not `>= 0` — logging zero grams is meaningless.
- `logged_at` is client-owned — server never overrides it. No future timestamps allowed. No past limit — backfill is supported.
- Two nullable FK columns with a CHECK enforcing exactly one is set. This is explicit and queryable — no enum column, no polymorphic FK magic.
- The composite FK `(user_food_id, user_id) → user_foods(id, user_id)` preserves the ownership enforcement from before. Public foods have no owner, so no equivalent FK is needed there — RLS on `public_foods` handles access.
- Macro query uses `LEFT JOIN` + `COALESCE` — exactly one join will match per row (guaranteed by the CHECK constraint).
- Log entries are editable — grams and time only. Food source columns are not editable; if the wrong food was logged, delete and re-log.
- Delete behavior: restricted on both FKs — a food cannot be deleted if logs reference it.
- Unit is never stored here — it lives on `user_foods` only.
- RLS: user can only read and write their own rows.

---

## `body_metrics`

One row per check-in. Editable — users can correct input errors.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | No | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | No | — | FK → `auth.users(id)` |
| `weight_kg` | `numeric(5,2)` | Yes | `null` | Check: `> 0` |
| `body_fat_pct` | `numeric(4,1)` | Yes | `null` | Check: `>= 0` and `<= 100` |
| `neck_cm` | `numeric(5,1)` | Yes | `null` | Check: `> 0` |
| `waist_cm` | `numeric(5,1)` | Yes | `null` | Check: `> 0` |
| `forearm_cm` | `numeric(5,1)` | Yes | `null` | Check: `> 0` |
| `logged_at` | `timestamptz` | No | — | Client-owned. Check: `<= now() + 5 min` |
| `updated_at` | `timestamptz` | No | `now()` | Auto-updated via trigger |
| `created_at` | `timestamptz` | No | `now()` | Auto-set on insert |

```sql
create table body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  weight_kg numeric(5,2) check (weight_kg > 0),
  body_fat_pct numeric(4,1) check (body_fat_pct >= 0 and body_fat_pct <= 100),
  neck_cm numeric(5,1) check (neck_cm > 0),
  waist_cm numeric(5,1) check (waist_cm > 0),
  forearm_cm numeric(5,1) check (forearm_cm > 0),
  -- note: time-based CHECK works for MVP; migrate to trigger before production
  logged_at timestamptz not null check (logged_at <= now() + interval '5 minutes'),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- at least one metric must be present — a row with only timestamps is junk data
  check (
    weight_kg is not null or body_fat_pct is not null or
    neck_cm is not null or waist_cm is not null or forearm_cm is not null
  )
);

create trigger body_metrics_updated_at
before update on body_metrics
for each row execute function update_updated_at();

create index on body_metrics (user_id, logged_at desc);

```

**BMI calculation** (at query time, never stored):

```sql
select
  bm.logged_at,
  bm.weight_kg,
  round(bm.weight_kg / power(p.height_m, 2), 1) as bmi
from body_metrics bm
join profiles p on p.id = bm.user_id
where bm.user_id = auth.uid()
  and bm.weight_kg is not null
order by bm.logged_at;
```

**Decisions:**
- All columns except `user_id`, `logged_at`, and `created_at` are nullable — a check-in with partial data is valid. User logs what they have.
- BMI is not stored — it is derived from `weight_kg` and `height_m` (stored on `profiles`) at query time. Storing it would create two sources of truth.
- `body_fat_pct` is entered manually — user reads it from a smart scale or measurement tool. Navy body fat % is a derived display value computed client-side from `neck_cm`, `waist_cm`, and `profiles.height_m` (male formula only). It is not stored — same pattern as BMI.
- Circumferences (`neck_cm`, `waist_cm`, `forearm_cm`) are present but low priority — nullable, no pressure to fill. Forearm is intentional: included for personal tracking use cases beyond standard body fat formulas (e.g. monitoring muscle gain in a specific area). It does not map to the US Navy body fat estimation method, which uses neck and waist only.
- Entries are editable — users can correct input errors (wrong weight, wrong date). `updated_at` tracks modifications. This matches the `food_logs` pattern. Historical trend analysis uses `logged_at`, not `created_at` or `updated_at`.
- `logged_at` is client-owned, same pattern as `food_logs`. No past limit, no future timestamps.
- RLS: user can read, insert, update, and delete their own rows.