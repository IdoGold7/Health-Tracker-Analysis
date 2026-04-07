-- Migration: add ON DELETE CASCADE to profiles.id FK → auth.users(id)

alter table profiles
  drop constraint profiles_id_fkey;

alter table profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
