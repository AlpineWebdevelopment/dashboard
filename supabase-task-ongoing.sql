-- Marks a card as being worked on right now.
--
-- Run this in the SQL editor of the dashboard's OWN Supabase project — check
-- the project name in the top-left before running.
--
-- Distinct from `done`: ongoing is work in flight, done is work finished. It is
-- also distinct from the Ongoing page's `ongoing_activities`, which tracks who
-- is working on what with a progress figure; this is just a flag on the card.

alter table public.tasks
  add column if not exists ongoing boolean not null default false;

-- PostgREST caches the schema; without this the API keeps answering with the
-- old column list until it happens to reload on its own.
select pg_notify('pgrst', 'reload schema');
