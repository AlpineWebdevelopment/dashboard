-- ============================================================
-- Full schema — run this once in Supabase SQL Editor.
-- Safe to re-run: everything uses IF NOT EXISTS / IF EXISTS.
-- ============================================================

-- ── Shared updated_at trigger function ───────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── Pages ────────────────────────────────────────────────────
create table if not exists pages (
  id         uuid default gen_random_uuid() primary key,
  title      text not null default 'Untitled',
  content    text not null default '',
  folder_id  uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

drop trigger if exists pages_updated_at on pages;
create trigger pages_updated_at
  before update on pages
  for each row execute function update_updated_at();

alter table pages enable row level security;
drop policy if exists "Allow all" on pages;
create policy "Allow all" on pages for all using (true) with check (true);

-- ── Spreadsheets ─────────────────────────────────────────────
create table if not exists spreadsheets (
  id         uuid default gen_random_uuid() primary key,
  name       text not null default 'Untitled Table',
  columns    jsonb not null default '[]',
  rows       jsonb not null default '[]',
  folder_id  uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

drop trigger if exists spreadsheets_updated_at on spreadsheets;
create trigger spreadsheets_updated_at
  before update on spreadsheets
  for each row execute function update_updated_at();

alter table spreadsheets enable row level security;
drop policy if exists "Allow all" on spreadsheets;
create policy "Allow all" on spreadsheets for all using (true) with check (true);

-- ── Folders ──────────────────────────────────────────────────
create table if not exists folders (
  id         uuid default gen_random_uuid() primary key,
  name       text not null default 'Untitled Folder',
  type       text not null check (type in ('pages', 'tables')),
  created_at timestamp with time zone default now() not null
);

alter table folders enable row level security;
drop policy if exists "Allow all" on folders;
create policy "Allow all" on folders for all using (true) with check (true);

-- Add folder FK if not already there
alter table pages
  add column if not exists folder_id uuid references folders(id) on delete set null;

alter table spreadsheets
  add column if not exists folder_id uuid references folders(id) on delete set null;

-- ── Kanban lists ─────────────────────────────────────────────
create table if not exists lists (
  id         uuid default gen_random_uuid() primary key,
  title      text not null default 'New List',
  position   int not null default 0,
  created_at timestamp with time zone default now() not null
);

alter table lists enable row level security;
drop policy if exists "Allow all" on lists;
create policy "Allow all" on lists for all using (true) with check (true);

-- ── Tasks ────────────────────────────────────────────────────
create table if not exists tasks (
  id          uuid default gen_random_uuid() primary key,
  title       text not null default '',
  description text not null default '',
  done        boolean not null default false,
  priority    text not null default 'none' check (priority in ('none', 'low', 'medium', 'high')),
  due_date    date,
  list_id     uuid references lists(id) on delete set null,
  position    float not null default 0,
  created_at  timestamp with time zone default now() not null,
  updated_at  timestamp with time zone default now() not null
);

-- Add columns to existing tasks table if upgrading from an older schema
alter table tasks add column if not exists description text not null default '';
alter table tasks add column if not exists list_id uuid references lists(id) on delete set null;
alter table tasks add column if not exists position float not null default 0;

drop trigger if exists tasks_updated_at on tasks;
create or replace function update_tasks_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on tasks
  for each row execute procedure update_tasks_updated_at();

alter table tasks enable row level security;
drop policy if exists "Allow all" on tasks;
create policy "Allow all" on tasks for all using (true) with check (true);

-- ── Seed default kanban lists (only if board is empty) ───────
do $$
declare
  todo_id uuid;
  done_id uuid;
begin
  if not exists (select 1 from lists limit 1) then
    insert into lists (title, position) values ('To Do', 0) returning id into todo_id;
    insert into lists (title, position) values ('In Progress', 1);
    insert into lists (title, position) values ('Done', 2) returning id into done_id;

    update tasks
      set list_id = todo_id, position = extract(epoch from created_at)
      where list_id is null and done = false;

    update tasks
      set list_id = done_id, position = extract(epoch from created_at)
      where list_id is null and done = true;
  end if;
end $$;

-- ── Scratch pad ──────────────────────────────────────────────
create table if not exists scratch_pad (
  id         int primary key default 1,
  content    text not null default '',
  updated_at timestamp with time zone default now() not null,
  constraint scratch_single_row check (id = 1)
);

insert into scratch_pad (id, content) values (1, '') on conflict do nothing;

alter table scratch_pad enable row level security;
drop policy if exists "Allow all" on scratch_pad;
create policy "Allow all" on scratch_pad for all using (true) with check (true);
