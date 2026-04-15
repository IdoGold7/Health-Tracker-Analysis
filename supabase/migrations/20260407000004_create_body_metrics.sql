-- Migration: create body_metrics table
-- Depends on: auth.users

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
  -- at least one metric must be present
  check (
    weight_kg is not null or body_fat_pct is not null or
    neck_cm is not null or waist_cm is not null or forearm_cm is not null
  )
);

create trigger body_metrics_updated_at
before update on body_metrics
for each row execute function update_updated_at();

create index on body_metrics (user_id, logged_at desc);

-- RLS
alter table body_metrics enable row level security;

create policy "body_metrics: users can select own rows"
  on body_metrics for select
  using (auth.uid() = user_id);

create policy "body_metrics: users can insert own rows"
  on body_metrics for insert
  with check (auth.uid() = user_id);

create policy "body_metrics: users can update own rows"
  on body_metrics for update
  using (auth.uid() = user_id);

create policy "body_metrics: users can delete own rows"
  on body_metrics for delete
  using (auth.uid() = user_id);
