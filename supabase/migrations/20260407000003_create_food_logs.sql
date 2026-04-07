-- Migration: create food_logs table
-- Depends on: auth.users, user_foods, public_foods

create table food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  user_food_id uuid references user_foods(id),
  public_food_id uuid references public_foods(id),
  -- composite FK ensures user_food_id belongs to this user
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

create index on food_logs (user_id, logged_at desc);
create index on food_logs (user_food_id);
create index on food_logs (public_food_id);

-- RLS
alter table food_logs enable row level security;

create policy "food_logs: users can select own rows"
  on food_logs for select
  using (auth.uid() = user_id);

create policy "food_logs: users can insert own rows"
  on food_logs for insert
  with check (auth.uid() = user_id);

create policy "food_logs: users can update own rows"
  on food_logs for update
  using (auth.uid() = user_id);

create policy "food_logs: users can delete own rows"
  on food_logs for delete
  using (auth.uid() = user_id);
