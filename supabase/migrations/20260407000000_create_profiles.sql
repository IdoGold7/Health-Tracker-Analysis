-- Migration: create profiles table
-- Depends on: auth.users (managed by Supabase Auth)

create table profiles (
  id uuid primary key references auth.users(id),
  target_kcal integer check (target_kcal >= 0),
  target_protein_g integer check (target_protein_g >= 0),
  target_carbs_g integer check (target_carbs_g >= 0),
  target_fat_g integer check (target_fat_g >= 0),
  height_m numeric(4,2) check (height_m > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reusable trigger function (used by all tables with updated_at)
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

-- RLS
alter table profiles enable row level security;

create policy "profiles: users can select own row"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles: users can insert own row"
  on profiles for insert
  with check (auth.uid() = id);

create policy "profiles: users can update own row"
  on profiles for update
  using (auth.uid() = id);
