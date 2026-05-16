-- ── Update folders type constraint to include calendars ──────
alter table folders drop constraint if exists folders_type_check;
alter table folders add constraint folders_type_check
  check (type in ('pages', 'tables', 'calendars'));

-- ── Calendars ─────────────────────────────────────────────────
create table if not exists calendars (
  id          uuid default gen_random_uuid() primary key,
  name        text not null default 'Untitled Calendar',
  description text not null default '',
  color       text not null default 'rose',
  goal        text not null default '',
  folder_id   uuid references folders(id) on delete set null,
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone default now() not null
);

drop trigger if exists calendars_updated_at on calendars;
create trigger calendars_updated_at
  before update on calendars
  for each row execute function update_updated_at();

alter table calendars enable row level security;
drop policy if exists "Allow all" on calendars;
create policy "Allow all" on calendars for all using (true) with check (true);

-- ── Calendar entries (one row per day per calendar) ───────────
create table if not exists calendar_entries (
  id          uuid default gen_random_uuid() primary key,
  calendar_id uuid not null references calendars(id) on delete cascade,
  date        date not null,
  completed   boolean not null default false,
  note        text not null default '',
  created_at  timestamp with time zone default now() not null,
  unique (calendar_id, date)
);

alter table calendar_entries enable row level security;
drop policy if exists "Allow all" on calendar_entries;
create policy "Allow all" on calendar_entries for all using (true) with check (true);
