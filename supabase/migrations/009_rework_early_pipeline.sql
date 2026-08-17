-- Retire Contacting and Qualified; wire the survivors together.
--
-- Run AFTER 008_add_unreachable_retry.sql, as a separate query. Safe to re-run.
--
-- Two states are removed because neither divided anything:
--
--   Contacting modelled "we are ringing them", but every new lead gets rung, so
--   it was true of every lead the moment it arrived. What follows the call is
--   one of six things, and those are what New lead now points at directly:
--
--     they booked            → Meeting booked
--     no answer, ring again  → Unreachable-retry
--     no answer, given up    → Unreachable
--     not interested         → Lost
--     wrong market           → Not our market
--     not now                → Nurture
--
--   Qualified sat between the meeting and what the meeting produced. But a lead
--   that qualifies always leaves with a demo or a contract to schedule, and the
--   four states after it already say which — so Qualified only ever repeated
--   what the next state was about to say. Meeting booked now points straight at
--   those four.
--
-- Neither value is dropped from the lead_status enum: Postgres cannot remove an
-- enum value without recreating the type, which would mean dropping and
-- rebuilding every function that takes a lead_status parameter. They are retired
-- instead — no transition points into or out of them, so they can never be
-- reached, and lib/lead-status.ts keeps them out of every dropdown.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- Guard against running this before 008.
do $$
declare
  v_missing text;
begin
  select string_agg(needed, ', ') into v_missing
  from unnest(array['UNREACHABLE_RETRY', 'EXTRA_MEETING_BOOKED', 'EXTRA_MEETING_CALL']) as needed
  where not exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'lead_status' and e.enumlabel = needed
  );

  if v_missing is not null then
    raise exception 'Run 008_add_unreachable_retry.sql first, as its own query (missing: %)', v_missing;
  end if;
end $$;

-- ─── Move anyone sitting in a retired state ──────────────────────────────────
--
-- Contacting → New lead: under the new shape that simply means "still to be
-- rung", which is what Contacting was being used for.
-- Qualified → Meeting booked: the step it used to follow, from which the demo
-- and contract states are now directly reachable.
--
-- Both routed through the backfill setting so the guard trigger allows the move
-- and records it as a correction rather than a step someone walked.

do $$
declare
  v_id uuid;
begin
  perform set_config('crm.backfill', 'on', true);

  perform set_config('crm.transition_note', 'Contacting retired — returned to New lead', true);
  for v_id in select id from leads where status = 'CONTACTING' loop
    update leads set status = 'NEW' where id = v_id;
  end loop;

  perform set_config('crm.transition_note', 'Qualified retired — returned to Meeting booked', true);
  for v_id in select id from leads where status = 'QUALIFIED' loop
    update leads set status = 'MEETING_BOOKED' where id = v_id;
  end loop;
end $$;

-- ─── Rewire the edges ────────────────────────────────────────────────────────

-- Everything into or out of the two retired states goes.
delete from lead_status_transitions
 where from_status in ('CONTACTING', 'QUALIFIED')
    or to_status   in ('CONTACTING', 'QUALIFIED');

insert into lead_status_transitions (from_status, to_status)
select f::lead_status, t::lead_status
from (values
  -- Every new lead gets a call. These are the six ways that call can end.
  ('NEW',               'MEETING_BOOKED'),
  ('NEW',               'UNREACHABLE_RETRY'),
  ('NEW',               'UNREACHABLE'),
  ('NEW',               'LOST'),
  ('NEW',               'DISQUALIFIED'),
  ('NEW',               'NURTURE'),

  -- Still chasing. Another missed call is not a status change — it is a logged
  -- call, which raises the attempt count and moves the follow-up date. The lead
  -- only leaves this state when something actually changes.
  ('UNREACHABLE_RETRY', 'MEETING_BOOKED'),
  ('UNREACHABLE_RETRY', 'UNREACHABLE'),
  ('UNREACHABLE_RETRY', 'LOST'),
  ('UNREACHABLE_RETRY', 'DISQUALIFIED'),
  ('UNREACHABLE_RETRY', 'NURTURE'),

  -- Given up, but reopenable: picking it up again means ringing again.
  ('UNREACHABLE',       'UNREACHABLE_RETRY'),

  -- Coming back to a parked lead also means ringing them.
  ('NURTURE',           'MEETING_BOOKED'),
  ('NURTURE',           'UNREACHABLE_RETRY'),

  -- What used to run through Qualified. A lead that leaves the meeting worth
  -- pursuing has either a demo, an extra meeting or a contract to arrange, and
  -- whether it is already booked or still to be scheduled is exactly what these
  -- states say.
  ('MEETING_BOOKED',    'DEMO_BOOKED'),
  ('MEETING_BOOKED',    'DEMO_CALL'),
  ('MEETING_BOOKED',    'EXTRA_MEETING_BOOKED'),
  ('MEETING_BOOKED',    'EXTRA_MEETING_CALL'),
  ('MEETING_BOOKED',    'CONTRACT_MEET'),
  ('MEETING_BOOKED',    'CONTRACT_CALL'),

  -- The extra meeting pair, mirroring the demo pair exactly.
  --
  -- Agreed to meet again, no time fixed yet. Same shape as Demo – to schedule:
  -- chase it until it is in the diary, or give up on it.
  ('EXTRA_MEETING_CALL',   'EXTRA_MEETING_BOOKED'),
  ('EXTRA_MEETING_CALL',   'LOST'),
  ('EXTRA_MEETING_CALL',   'UNREACHABLE'),
  ('EXTRA_MEETING_CALL',   'NURTURE'),

  -- In the diary. From here the deal can go anywhere a booked demo can.
  ('EXTRA_MEETING_BOOKED', 'EXTRA_MEETING_CALL'),
  ('EXTRA_MEETING_BOOKED', 'CONTRACT_MEET'),
  ('EXTRA_MEETING_BOOKED', 'CONTRACT_CALL'),
  ('EXTRA_MEETING_BOOKED', 'DECISION_PENDING'),
  ('EXTRA_MEETING_BOOKED', 'CONVERTED'),
  ('EXTRA_MEETING_BOOKED', 'LOST'),
  ('EXTRA_MEETING_BOOKED', 'NURTURE'),

  -- The two peers reach each other, in both directions: an extra meeting can
  -- lead to a demo, and a demo can turn out to need another conversation before
  -- anyone signs. Without these a lead would have to be backfilled to move
  -- between two states that sit at the same level.
  ('EXTRA_MEETING_BOOKED', 'DEMO_BOOKED'),
  ('EXTRA_MEETING_BOOKED', 'DEMO_CALL'),
  ('DEMO_BOOKED',          'EXTRA_MEETING_BOOKED'),
  ('DEMO_BOOKED',          'EXTRA_MEETING_CALL')
) as v(f, t)
on conflict (from_status, to_status) do nothing;

-- ─── Check ───────────────────────────────────────────────────────────────────

do $$
declare
  v_retired int;
  v_total   int;
  v_stuck   int;
begin
  select count(*) into v_retired from lead_status_transitions
   where from_status in ('CONTACTING', 'QUALIFIED')
      or to_status   in ('CONTACTING', 'QUALIFIED');
  if v_retired > 0 then
    raise exception 'retired states still have % edge(s)', v_retired;
  end if;

  select count(*) into v_stuck from leads where status in ('CONTACTING', 'QUALIFIED');
  if v_stuck > 0 then
    raise exception '% lead(s) are still in a retired status', v_stuck;
  end if;

  -- Every remaining status must still be able to reach Customer, or the
  -- pipeline has a hole that only the backfill escape could get out of.
  if not exists (select 1 from lead_status_transitions where to_status = 'CONVERTED') then
    raise exception 'nothing can reach CONVERTED any more';
  end if;

  select count(*) into v_total from lead_status_transitions;
  raise notice 'transition table now holds % edges', v_total;
end $$;
