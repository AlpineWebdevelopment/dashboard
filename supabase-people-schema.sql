-- People (task assignees — pick who a task belongs to via the person button above the board)
create table if not exists people (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'Unnamed',
  position int not null default 0,
  created_at timestamp with time zone default now() not null
);

alter table people enable row level security;
create policy "Allow all" on people for all using (true) with check (true);

-- Tasks are assigned to at most one person. Deleting a person leaves their tasks unassigned.
alter table tasks add column if not exists assignee_id uuid references people(id) on delete set null;
create index if not exists tasks_assignee_id_idx on tasks(assignee_id);
