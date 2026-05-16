-- Folders table (shared by pages and tables sections)
create table if not exists folders (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'Untitled Folder',
  type text not null check (type in ('pages', 'tables')),
  created_at timestamp with time zone default now() not null
);

alter table folders enable row level security;
create policy "Allow all" on folders for all using (true) with check (true);

-- Add folder_id to pages
alter table pages add column if not exists folder_id uuid references folders(id) on delete set null;

-- Add folder_id to spreadsheets
alter table spreadsheets add column if not exists folder_id uuid references folders(id) on delete set null;
