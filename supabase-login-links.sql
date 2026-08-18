-- Login Hub links.
--
-- Run this in the SQL editor of the dashboard's OWN Supabase project (not the
-- Atrium CRM one — check the project name in the top-left before running).
--
-- Links only. Never put a password or token in this table: it is served to the
-- browser with the anon key, so anything in here is readable by anyone who can
-- open the dashboard.

create table if not exists public.login_links (
  id          uuid primary key default gen_random_uuid(),
  -- Which of the two hub sections this belongs to. See SECTIONS in
  -- src/lib/login-hub.ts.
  section     text        not null default 'S',
  -- Groups links inside a section: "Gmail", "Supabase", …
  service     text        not null default '',
  -- Logo key, matched against BRAND_MARKS in components/BrandMark.tsx.
  brand       text        not null default '',
  -- What you call this link.
  label       text        not null,
  url         text        not null,
  -- Optional second line: the email, the org, whatever tells them apart.
  hint        text,
  position    integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists login_links_section_idx on public.login_links (section, service, position);

-- This dashboard has no per-user auth; it sits behind its own gate and talks to
-- Supabase with the anon key, matching the other tables here.
alter table public.login_links disable row level security;
grant all on public.login_links to anon, authenticated;

-- PostgREST caches the schema; without this the API answers "table not found"
-- until it happens to reload on its own.
select pg_notify('pgrst', 'reload schema');
