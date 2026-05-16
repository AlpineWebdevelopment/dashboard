-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Note: the update_updated_at() function already exists from supabase-schema.sql
-- If you haven't run that yet, run supabase-schema.sql first.

create table if not exists spreadsheets (
  id         uuid default gen_random_uuid() primary key,
  name       text not null default 'Untitled Table',
  columns    jsonb not null default '[]',
  rows       jsonb not null default '[]',
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create trigger spreadsheets_updated_at
  before update on spreadsheets
  for each row execute function update_updated_at();

alter table spreadsheets enable row level security;
create policy "Allow all" on spreadsheets for all using (true) with check (true);
