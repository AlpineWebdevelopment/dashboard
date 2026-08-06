-- Projects (task grouping — shown as folder buttons above the Kanban board)
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'Untitled Project',
  color text not null default '',
  position int not null default 0,
  created_at timestamp with time zone default now() not null
);

-- Colour label. Empty string = fall back to a tint picked from the project's position.
alter table projects add column if not exists color text not null default '';

alter table projects enable row level security;
create policy "Allow all" on projects for all using (true) with check (true);

-- Tasks belong to at most one project. Deleting a project leaves its tasks in place.
alter table tasks add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists tasks_project_id_idx on tasks(project_id);
