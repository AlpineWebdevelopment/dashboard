-- Remove the stray atrium-crm tables from the dashboard's Supabase project.
--
-- Run this BEFORE 001_leads.sql. Safe to re-run.
--
-- Why this exists: atrium-crm's schema was at some point run against the
-- dashboard project (figvcskjslkvomoxubuq) as well as its own. It left behind
-- leads / lead_notes / lead_activity / audit_log in the old shape — leads.name,
-- source_niche, consent_text_version, a TEXT status with eight values. All four
-- are empty and nothing in src/ reads them.
--
-- They have to go rather than be migrated: `create table if not exists leads`
-- silently skips when a leads table already exists, so 001 would appear to run
-- and then fail on the first index against a column it never created
-- (ERROR 42703: column "next_action_at" does not exist).
--
-- The real atrium-crm data is NOT here. It lives in project wqogqksfnlzgdzgfflpy,
-- which this repo does not touch and which the Atrium website keeps writing to.

-- ─── Safety check ────────────────────────────────────────────────────────────
-- Verified empty at the time of writing. If that has changed since, this
-- refuses to drop anything and tells you which table has rows — deal with the
-- data first, then re-run.

do $$
declare
  t      text;
  n      bigint;
  tables constant text[] := array['lead_notes', 'lead_activity', 'audit_log', 'leads'];
begin
  foreach t in array tables loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'skip: %.% does not exist', 'public', t;
      continue;
    end if;

    -- Guard against dropping the NEW leads table by mistake: if it already has
    -- the new shape, 001 has run and there is nothing here to clean up.
    if t = 'leads' and exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'leads'
         and column_name = 'next_action_at'
    ) then
      raise exception
        'public.leads already has the new shape — 001_leads.sql has run. Nothing to drop.';
    end if;

    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then
      raise exception 'refusing to drop public.%: it holds % row(s)', t, n;
    end if;
  end loop;
end $$;

-- ─── Drop, children first ────────────────────────────────────────────────────
-- No CASCADE on purpose. These default to RESTRICT, so if something does depend
-- on one of them the drop fails loudly instead of quietly taking it along.

drop table if exists public.lead_notes;
drop table if exists public.lead_activity;
drop table if exists public.audit_log;
drop table if exists public.leads;

-- atrium's generic update_updated_at() function is left in place. It is
-- harmless, may belong to something else, and 001 defines its own
-- leads_set_updated_at() rather than reusing it.
