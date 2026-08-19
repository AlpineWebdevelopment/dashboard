-- When each lead was last touched.
--
-- Safe to re-run. Nothing about the schema changes here; this is one read-only
-- aggregate.
--
-- The worklist wants to show how long a lead has been sitting, which means the
-- newest lead_events row per lead. The app could select every event and reduce
-- them in JavaScript — that works today, at twenty-odd events, and quietly
-- stops working later, since it transfers the entire history on every page
-- load to compute one timestamp per lead. Grouping in the database sends one
-- row per lead instead.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- ─── crm_lead_last_events ────────────────────────────────────────────────────
--
-- Leads with no events at all are absent rather than present with a null: the
-- caller falls back to created_at for those, and "no row" says that more
-- plainly than a null would. An imported lead often has no events — it arrived
-- and nothing has happened to it yet.

create or replace function crm_lead_last_events()
returns table (lead_id uuid, last_event_at timestamptz)
language sql
stable
as $$
  select lead_id, max(occurred_at) as last_event_at
    from lead_events
   group by lead_id
$$;

-- Service role only, matching crm_transition_lead and crm_convert_lead_to_client.
-- RLS on lead_events would stop an anon caller anyway; revoking says so out loud.
revoke all on function crm_lead_last_events() from public, anon, authenticated;

-- ─── Check ───────────────────────────────────────────────────────────────────

do $$
declare
  v_leads int;
  v_rows  int;
begin
  select count(distinct lead_id) into v_leads from lead_events;
  select count(*) into v_rows from crm_lead_last_events();

  if v_rows <> v_leads then
    raise exception 'expected % row(s), got %', v_leads, v_rows;
  end if;

  raise notice 'crm_lead_last_events covers % lead(s) with history', v_rows;
end $$;
