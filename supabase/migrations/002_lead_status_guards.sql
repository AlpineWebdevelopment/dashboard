-- CRM lead management — status change guards
--
-- Run after 001_leads.sql. Safe to re-run.
--
-- Enforcement lives here, in the database, not in the application. The app
-- layer will eventually be wrong — a bad form post, a stale client, a script
-- someone runs at 2am — and the database still has to refuse. Everything below
-- fires on every UPDATE regardless of who issued it, including the service role.

-- ─── Wrong-database guard ────────────────────────────────────────────────────
-- ongoing_activities exists only in the dashboard project; its absence means
-- the SQL editor is pointed at the wrong project.

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- Fires only when status actually changes; ordinary field edits skip it
-- entirely. Note that plain edits therefore CANNOT move a lead — `status` is
-- either untouched or it goes through every check in this function.
create or replace function leads_guard_status_change()
returns trigger as $$
declare
  v_note           text;
  v_is_hard_terminal boolean;
begin
  -- 1 ── the move must be one the transition table allows
  if not exists (
    select 1 from lead_status_transitions
    where from_status = old.status
      and to_status   = new.status
  ) then
    raise exception 'Nem megengedett státuszváltás: % → %', old.status, new.status
      using errcode = 'check_violation',
            hint    = 'A megengedett lépések a lead_status_transitions táblában vannak.';
  end if;

  -- 2 ── states a lead can silently rot in must carry a date
  if new.status in (
    'CONTACTING', 'MEETING_CALL', 'DEMO_CALL',
    'CONTRACT_CALL', 'DECISION_PENDING', 'NURTURE'
  ) then
    if new.next_action_at is null then
      raise exception '% státuszhoz kötelező a következő lépés dátuma', new.status
        using errcode = 'check_violation';
    end if;
    -- Checked on entry only. A date that lapses while the lead sits there is
    -- the entire point of the worklist — that lead is overdue, not invalid.
    if new.next_action_at < now() then
      raise exception '% státuszhoz a következő lépés dátuma nem lehet múltbeli (%)',
        new.status, new.next_action_at
        using errcode = 'check_violation';
    end if;
  end if;

  -- 3 ── closing a lead requires saying why
  if new.status in ('LOST', 'DISQUALIFIED', 'UNREACHABLE') then
    if new.lost_reason is null or btrim(new.lost_reason) = '' then
      raise exception '% státuszhoz kötelező az indoklás', new.status
        using errcode = 'check_violation';
    end if;
  end if;

  -- 4 ── hard terminals carry no future work
  -- "Hard terminal" is derived, not listed: it is a status with no outgoing
  -- edge in the transition table. Currently CONVERTED and DISQUALIFIED. Add an
  -- edge out of one of them and this stops treating it as terminal, with no
  -- code change here.
  select not exists (
    select 1 from lead_status_transitions where from_status = new.status
  ) into v_is_hard_terminal;

  if v_is_hard_terminal then
    new.next_action_at := null;
  end if;

  -- 5 ── every move leaves a trace, non-optionally
  --
  -- The note rides in on a transaction-local setting rather than a column,
  -- because the note belongs to the event and not to the lead. transitionLead()
  -- does:  select set_config('crm.transition_note', $1, true)
  -- in the same transaction as the update. `true` = transaction-scoped, so it
  -- cannot leak into the next statement on a pooled connection.
  v_note := nullif(btrim(coalesce(current_setting('crm.transition_note', true), '')), '');

  insert into lead_events (lead_id, from_status, to_status, note)
  values (new.id, old.status, new.status, v_note);

  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_status_guard on leads;
create trigger leads_status_guard
  before update on leads
  for each row
  when (old.status is distinct from new.status)
  execute function leads_guard_status_change();

-- Trigger firing order is alphabetical by name, so leads_status_guard runs
-- before leads_updated_at. Both return NEW and neither depends on the other.
