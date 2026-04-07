-- Migration: create public_foods table
-- Depends on: nothing (no table FKs)

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

-- RLS
alter table public_foods enable row level security;

create policy "public_foods: authenticated users can select"
  on public_foods for select
  to authenticated
  using (true);
