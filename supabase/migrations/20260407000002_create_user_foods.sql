-- Migration: create user_foods table
-- Depends on: auth.users, public_foods

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

-- composite unique: enables composite FK ownership check from food_logs
alter table user_foods add unique (id, user_id);

create index on user_foods (user_id, name);
create index on user_foods (source_public_food_id);

-- prevents duplicate copies of the same public food per user
create unique index on user_foods (user_id, source_public_food_id)
  where source_public_food_id is not null;

-- RLS
alter table user_foods enable row level security;

create policy "user_foods: users can select own rows"
  on user_foods for select
  using (auth.uid() = user_id);

create policy "user_foods: users can insert own rows"
  on user_foods for insert
  with check (auth.uid() = user_id);

create policy "user_foods: users can update own rows"
  on user_foods for update
  using (auth.uid() = user_id);

create policy "user_foods: users can delete own rows"
  on user_foods for delete
  using (auth.uid() = user_id);
