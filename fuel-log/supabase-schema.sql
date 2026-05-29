-- Run this entire file in your Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run

-- Table: daily log entries
create table if not exists log_entries (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,           -- e.g. 2025-08-01
  day_type    text not null default 'moderate', -- rest|light|moderate|hard|race
  name        text not null,
  kcal        integer not null default 0,
  protein_g   integer not null default 0,
  carbs_g     integer not null default 0,
  fat_g       integer not null default 0,
  source      text not null default 'manual', -- manual|quick|voice|photo
  logged_at   timestamptz not null default now()
);

-- Table: daily metadata (day_type, weight)
create table if not exists daily_meta (
  date        date primary key,
  day_type    text not null default 'moderate',
  weight_lbs  numeric(5,1),
  updated_at  timestamptz not null default now()
);

-- Index for fast date lookups
create index if not exists log_entries_date_idx on log_entries(date);

-- Enable Row Level Security (keeps data private)
alter table log_entries enable row level security;
alter table daily_meta  enable row level security;

-- Policy: allow all operations (it's a personal app with PIN auth)
-- If you want stricter auth later, update these policies
create policy "allow all" on log_entries for all using (true) with check (true);
create policy "allow all" on daily_meta  for all using (true) with check (true);
