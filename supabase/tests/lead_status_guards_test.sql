-- Tests for the lead status guards (002_lead_status_guards.sql).
--
-- How to run — either works:
--   psql "$DATABASE_URL" -f supabase/tests/lead_status_guards_test.sql
--   Supabase SQL editor: paste the whole file and run
--
-- Everything happens inside a transaction that ROLLS BACK at the end, so it is
-- safe against a database with real leads in it. Test rows are tagged
-- company_name = '__guard_test__' and every count below is scoped to them.
--
-- Any failure raises and aborts the run. Reaching the final notice means all
-- assertions passed.

begin;

-- ─── 1. Every legal edge succeeds ────────────────────────────────────────────
-- Driven off lead_status_transitions itself rather than a hardcoded list, so
-- an edge added to the table is automatically covered here.
--
-- Each edge gets a fresh lead inserted directly at from_status. INSERT is not
-- guarded (the trigger is BEFORE UPDATE), which is what lets each edge be
-- tested in isolation instead of by walking the graph. The update supplies both
-- next_action_at and lost_reason so whichever of guards 2/3 applies is
-- satisfied.

do $$
declare
  e       record;
  v_lead  uuid;
  v_landed lead_status;
  v_count int := 0;
begin
  for e in select from_status, to_status from lead_status_transitions
           order by from_status, to_status
  loop
    insert into leads (company_name, status, lost_reason)
    values ('__guard_test__', e.from_status, 'seed')
    returning id into v_lead;

    update leads
       set status         = e.to_status,
           next_action_at = now() + interval '3 days',
           lost_reason    = 'teszt indok'
     where id = v_lead;

    select status into v_landed from leads where id = v_lead;
    if v_landed is distinct from e.to_status then
      raise exception 'FAIL: legal edge % → % did not apply (landed on %)',
        e.from_status, e.to_status, v_landed;
    end if;

    v_count := v_count + 1;
  end loop;

  if v_count <> 51 then
    raise exception 'FAIL: expected 51 legal edges, exercised %', v_count;
  end if;
  raise notice 'PASS  1. legal edges: % / 51', v_count;
end $$;

-- ─── 2. Illegal edges are rejected ───────────────────────────────────────────
-- A caught exception in plpgsql rolls back its subtransaction, so the assertion
-- that matters is the observable one: the lead did not move, and no event was
-- written for it.

do $$
declare
  v_lead   uuid;
  v_status lead_status;
  v_events int;
  v_failed boolean;

  cases constant text[][] := array[
    -- from,            to,             why it must fail
    ['NEW',           'CONVERTED',    'skips the entire pipeline'],
    ['CONVERTED',     'CONTACTING',   'CONVERTED is a hard terminal'],
    ['CONVERTED',     'LOST',         'CONVERTED is a hard terminal'],
    ['CONVERTED',     'NURTURE',      'CONVERTED is a hard terminal'],
    ['DISQUALIFIED',  'CONTACTING',   'DISQUALIFIED is a hard terminal'],
    ['QUALIFIED',     'MEETING_BOOKED', 'no going back up the pipeline'],
    ['NEW',           'NURTURE',      'NEW may only start or be disqualified'],
    ['MEETING_CALL',  'QUALIFIED',    'a no-show drops back a step, never forward']
  ];
  c text[];
begin
  foreach c slice 1 in array cases loop
    insert into leads (company_name, status, lost_reason)
    values ('__guard_test__', c[1]::lead_status, 'seed')
    returning id into v_lead;

    v_failed := false;
    begin
      update leads
         set status         = c[2]::lead_status,
             next_action_at = now() + interval '3 days',
             lost_reason    = 'teszt indok'
       where id = v_lead;
    exception when others then
      v_failed := true;
    end;

    if not v_failed then
      raise exception 'FAIL: illegal edge % → % was accepted (%)', c[1], c[2], c[3];
    end if;

    select status into v_status from leads where id = v_lead;
    if v_status <> c[1]::lead_status then
      raise exception 'FAIL: rejected edge % → % still moved the lead to %',
        c[1], c[2], v_status;
    end if;

    select count(*) into v_events from lead_events where lead_id = v_lead;
    if v_events <> 0 then
      raise exception 'FAIL: rejected edge % → % wrote % event row(s)',
        c[1], c[2], v_events;
    end if;
  end loop;

  raise notice 'PASS  2. illegal edges rejected: % cases', array_length(cases, 1);
end $$;

-- ─── 3. Guard 2 — next_action_at required, and not in the past ───────────────

do $$
declare
  v_lead   uuid;
  v_failed boolean;
  s        text;
  -- every state that must not be enterable without a date
  states constant text[] := array[
    'CONTACTING', 'MEETING_CALL', 'DEMO_CALL',
    'CONTRACT_CALL', 'DECISION_PENDING', 'NURTURE'
  ];
  -- a legal predecessor for each of the above, in the same order
  froms  constant text[] := array[
    'NEW', 'MEETING_BOOKED', 'QUALIFIED',
    'QUALIFIED', 'DEMO_BOOKED', 'CONTACTING'
  ];
  i int;
begin
  for i in 1 .. array_length(states, 1) loop
    s := states[i];

    -- 3a. missing date is refused
    insert into leads (company_name, status, lost_reason)
    values ('__guard_test__', froms[i]::lead_status, 'seed')
    returning id into v_lead;

    v_failed := false;
    begin
      update leads
         set status = s::lead_status, next_action_at = null, lost_reason = 'teszt indok'
       where id = v_lead;
    exception when others then
      v_failed := true;
    end;
    if not v_failed then
      raise exception 'FAIL: entered % with a null next_action_at', s;
    end if;

    -- 3b. a date in the past is refused
    v_failed := false;
    begin
      update leads
         set status = s::lead_status,
             next_action_at = now() - interval '1 day',
             lost_reason = 'teszt indok'
       where id = v_lead;
    exception when others then
      v_failed := true;
    end;
    if not v_failed then
      raise exception 'FAIL: entered % with a past next_action_at', s;
    end if;

    -- 3c. a future date is accepted
    update leads
       set status = s::lead_status,
           next_action_at = now() + interval '2 days',
           lost_reason = 'teszt indok'
     where id = v_lead;

    if (select status from leads where id = v_lead) <> s::lead_status then
      raise exception 'FAIL: could not enter % with a valid next_action_at', s;
    end if;
  end loop;

  raise notice 'PASS  3. next_action_at guard: % states', array_length(states, 1);
end $$;

-- ─── 4. Guard 3 — lost_reason required ───────────────────────────────────────

do $$
declare
  v_lead   uuid;
  v_failed boolean;
  s        text;
  states constant text[] := array['LOST', 'DISQUALIFIED', 'UNREACHABLE'];
  froms  constant text[] := array['CONTACTING', 'NEW', 'CONTACTING'];
  i int;
  bad text;
begin
  for i in 1 .. array_length(states, 1) loop
    s := states[i];

    -- both null and whitespace-only must be refused
    foreach bad in array array[null, '', '   ']::text[] loop
      insert into leads (company_name, status)
      values ('__guard_test__', froms[i]::lead_status)
      returning id into v_lead;

      v_failed := false;
      begin
        update leads
           set status = s::lead_status, lost_reason = bad
         where id = v_lead;
      exception when others then
        v_failed := true;
      end;
      if not v_failed then
        raise exception 'FAIL: entered % with lost_reason = %', s, coalesce(quote_literal(bad), 'NULL');
      end if;
    end loop;

    -- a real reason is accepted
    insert into leads (company_name, status)
    values ('__guard_test__', froms[i]::lead_status)
    returning id into v_lead;

    update leads
       set status = s::lead_status, lost_reason = 'nem fér bele a keret'
     where id = v_lead;

    if (select status from leads where id = v_lead) <> s::lead_status then
      raise exception 'FAIL: could not enter % with a valid lost_reason', s;
    end if;
  end loop;

  raise notice 'PASS  4. lost_reason guard: % states', array_length(states, 1);
end $$;

-- ─── 5. Guard 4 — hard terminals clear next_action_at ────────────────────────

do $$
declare
  v_lead uuid;
  v_next timestamptz;
begin
  -- CONVERTED, reached from DECISION_PENDING which itself carries a date
  insert into leads (company_name, status, next_action_at)
  values ('__guard_test__', 'DECISION_PENDING', now() + interval '5 days')
  returning id into v_lead;

  update leads set status = 'CONVERTED' where id = v_lead;

  select next_action_at into v_next from leads where id = v_lead;
  if v_next is not null then
    raise exception 'FAIL: CONVERTED kept next_action_at = %', v_next;
  end if;

  -- DISQUALIFIED, which also has to satisfy guard 3 on the way in
  insert into leads (company_name, status, next_action_at)
  values ('__guard_test__', 'NEW', now() + interval '5 days')
  returning id into v_lead;

  update leads set status = 'DISQUALIFIED', lost_reason = 'nem célpiac' where id = v_lead;

  select next_action_at into v_next from leads where id = v_lead;
  if v_next is not null then
    raise exception 'FAIL: DISQUALIFIED kept next_action_at = %', v_next;
  end if;

  -- a soft terminal must NOT be cleared — it is reopenable and keeps its date
  insert into leads (company_name, status)
  values ('__guard_test__', 'CONTACTING')
  returning id into v_lead;

  update leads
     set status = 'UNREACHABLE',
         next_action_at = now() + interval '30 days',
         lost_reason = 'nem veszi fel'
   where id = v_lead;

  select next_action_at into v_next from leads where id = v_lead;
  if v_next is null then
    raise exception 'FAIL: UNREACHABLE is a soft terminal and should keep next_action_at';
  end if;

  raise notice 'PASS  5. hard terminals clear next_action_at, soft ones do not';
end $$;

-- ─── 6. Every successful transition wrote exactly one event ──────────────────

do $$
declare
  v_moves  int;
  v_events int;
  v_bad    int;
begin
  -- one event per test lead that actually moved
  select count(*) into v_events
    from lead_events e
    join leads l on l.id = e.lead_id
   where l.company_name = '__guard_test__';

  -- a lead that moved is one whose current status differs from nothing we can
  -- recover — so instead assert the shape of what was written
  select count(*) into v_bad
    from lead_events e
    join leads l on l.id = e.lead_id
   where l.company_name = '__guard_test__'
     and (e.from_status is null or e.to_status is null or e.occurred_at is null);

  if v_bad > 0 then
    raise exception 'FAIL: % event row(s) written with a null from/to/occurred_at', v_bad;
  end if;

  -- every event's to_status must be a legal successor of its from_status
  select count(*) into v_bad
    from lead_events e
    join leads l on l.id = e.lead_id
   where l.company_name = '__guard_test__'
     and not exists (
       select 1 from lead_status_transitions t
        where t.from_status = e.from_status and t.to_status = e.to_status
     );

  if v_bad > 0 then
    raise exception 'FAIL: % event row(s) record a transition the table forbids', v_bad;
  end if;

  -- 51 from section 1 + 6 from section 3c + 3 from section 4 + 3 from section 5
  v_moves := 51 + 6 + 3 + 3;
  if v_events <> v_moves then
    raise exception 'FAIL: expected % event rows, found %', v_moves, v_events;
  end if;

  raise notice 'PASS  6. event log: % rows, one per successful move', v_events;
end $$;

-- ─── 7. lead_events is append-only ───────────────────────────────────────────

do $$
declare
  v_lead   uuid;
  v_event  uuid;
  v_failed boolean;
begin
  insert into leads (company_name, status)
  values ('__guard_test__', 'NEW')
  returning id into v_lead;

  update leads
     set status = 'CONTACTING', next_action_at = now() + interval '1 day'
   where id = v_lead;

  select id into v_event from lead_events where lead_id = v_lead limit 1;

  v_failed := false;
  begin
    update lead_events set note = 'tampered' where id = v_event;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'FAIL: lead_events row was updatable';
  end if;

  v_failed := false;
  begin
    delete from lead_events where id = v_event;
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'FAIL: lead_events row was deletable';
  end if;

  raise notice 'PASS  7. lead_events rejects update and delete';
end $$;

do $$ begin raise notice '── all guard tests passed ──'; end $$;

rollback;
