-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists pages (
  id uuid default gen_random_uuid() primary key,
  title text not null default 'Untitled',
  content text not null default '',
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Auto-update updated_at on row change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pages_updated_at
  before update on pages
  for each row execute function update_updated_at();

-- Allow public read/write (no auth — personal dashboard)
alter table pages enable row level security;
create policy "Allow all" on pages for all using (true) with check (true);
