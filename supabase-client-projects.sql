-- /client-projects: the delivery board, and the one page the client account
-- can open.
--
-- Run this in the SQL editor of the dashboard's OWN Supabase project — check
-- the project name in the top-left first (figvcskjslkvomoxubuq).
--
-- Safe to re-run: every statement is guarded, so a second run is a no-op.
--
-- Deliberately NOT the same table as `mrr_clients`. That one is a billing
-- contract — setup fee, monthly fee, go-live date. This is the work: a client
-- can have several projects under one contract, and no money is stored here.
-- Keeping them apart is what lets the client account read this table's page
-- without ever being near the revenue figures.
--
-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Reads and writes come through server actions in `src/lib/actions.ts`, which
-- use NEXT_PUBLIC_SUPABASE_ANON_KEY like the rest of the board tables (tasks,
-- ongoing_activities, mrr_clients). So `anon` needs full access here, the same
-- posture those already have — the gate is the dashboard's own session, not
-- RLS. The write actions check for an admin session before they touch this
-- table; RLS cannot make that distinction, because both roles arrive as `anon`.
--
-- If the board tables are ever moved behind SUPABASE_SERVICE_ROLE_KEY, this
-- policy should be dropped in the same pass.

begin;

create extension if not exists pgcrypto;

create table if not exists public.client_projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  -- Who it is for. Free text on purpose: these are not rows in any clients
  -- table, and typing the name is faster than maintaining a second list.
  client      text not null default '',
  description text not null default '',
  status      text not null default 'planning'
              check (status in ('planning','in_progress','review','live','paused')),
  -- 0-100, independent of status: a paused project keeps the figure it had.
  progress    int  not null default 0 check (progress between 0 and 100),
  due_date    date,
  -- Staging or live URL, rendered as a link on the card. '' = none.
  url         text not null default '',
  -- The latest word for the client — what is happening on this right now.
  note        text not null default '',
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists client_projects_position_idx on public.client_projects(position);

alter table public.client_projects enable row level security;

drop policy if exists client_projects_anon_all on public.client_projects;
create policy client_projects_anon_all
  on public.client_projects
  for all
  to anon, authenticated
  using (true)
  with check (true);

commit;

-- PostgREST caches the schema; without this the API keeps answering with the
-- old table list until it happens to reload on its own.
select pg_notify('pgrst', 'reload schema');
