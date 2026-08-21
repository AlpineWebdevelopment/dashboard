-- How far along a task is, for the ones flagged ongoing.
--
-- Run this in the SQL editor of the dashboard's OWN Supabase project — check
-- the project name in the top-left before running.
--
-- Separate from `ongoing_activities.progress`, which belongs to an activity
-- card. This one belongs to the task itself, so a card flagged ongoing on the
-- board can carry a percentage without first being turned into an activity.

alter table public.tasks
  add column if not exists progress smallint not null default 0;

-- Keep it a percentage. Named so a second run finds it already there.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_progress_range'
  ) then
    alter table public.tasks
      add constraint tasks_progress_range check (progress between 0 and 100);
  end if;
end $$;

-- PostgREST caches the schema; without this the API keeps answering with the
-- old column list until it happens to reload on its own.
select pg_notify('pgrst', 'reload schema');
