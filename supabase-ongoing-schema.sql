-- Ongoing: what each person is working on right now (the /ongoing page).
-- A card either tracks a task from the board or is a free-standing "activity".
-- Run this in the Supabase SQL editor. Safe to re-run.

create table if not exists ongoing_activities (
  id uuid default gen_random_uuid() primary key,
  -- Set when the card tracks a board task; null for a free-standing activity.
  -- The card outlives the task: deleting the task just unlinks it.
  task_id uuid references tasks(id) on delete set null,
  -- Who is doing it (people.id — the same assignees the tasks board uses).
  person_id uuid references people(id) on delete set null,
  -- The activity's own name. For a tracked task this holds a snapshot of the
  -- task title so the card still reads well once the task is gone.
  title text not null default '',
  -- Free text — where they're at right now ("waiting on feedback", "blocked"…).
  state text not null default '',
  progress int not null default 0 check (progress between 0 and 100),
  -- Hitting 100% never removes a card; someone has to archive it explicitly.
  archived boolean not null default false,
  archived_at timestamp with time zone,
  position int not null default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create or replace function update_ongoing_activities_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger ongoing_activities_updated_at
  before update on ongoing_activities
  for each row execute procedure update_ongoing_activities_updated_at();

alter table ongoing_activities enable row level security;
drop policy if exists "Allow all" on ongoing_activities;
create policy "Allow all" on ongoing_activities for all using (true) with check (true);

create index if not exists ongoing_activities_archived_idx on ongoing_activities(archived);
create index if not exists ongoing_activities_person_id_idx on ongoing_activities(person_id);
create index if not exists ongoing_activities_task_id_idx on ongoing_activities(task_id);
