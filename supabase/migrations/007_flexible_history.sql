-- Make the pipeline guide rather than obstruct.
--
-- Run after 006_convert_lead_to_client.sql. Safe to re-run.
--
-- Four changes, all driven by the same problem: the rules assumed every status
-- change is happening right now, which made entering real history impossible.
--
--   1. next_action_at is optional, and may be any date.
--      Guards CR002 (required) and CR003 (must be future) are removed. They
--      forced a future date onto a step that already happened months ago —
--      there is no future date that honestly describes "I called them in March",
--      so the rule made truthful backfilling impossible. A reason is still
--      required for closing states (CR004): unlike a date, you can always say
--      why an old lead went nowhere.
--
--   2. A backfill escape. The transition table still drives the normal
--      dropdown, but a caller that explicitly asks for it can move a lead
--      anywhere. The event records that it was a manual correction, so a
--      reconstructed history never masquerades as a real pipeline run.
--
--   3. lead_events carries non-status entries — calls, emails, meetings,
--      plain notes — so something can be recorded without pretending the lead
--      moved.
--
--   4. An event's occurred_at and note become editable. What happened stays
--      immutable; when it happened and what you wrote about it do not.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- ─── lead_events: entries that are not status changes ────────────────────────

alter table lead_events add column if not exists kind text not null default 'status_change';

-- A note or a logged call has no destination status.
alter table lead_events alter column to_status drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lead_events_kind_check') then
    alter table lead_events add constraint lead_events_kind_check
      check (kind in ('status_change', 'backfill', 'note', 'call', 'email', 'meeting'));
  end if;

  -- A status entry without a destination would be meaningless.
  if not exists (select 1 from pg_constraint where conname = 'lead_events_status_needs_target') then
    alter table lead_events add constraint lead_events_status_needs_target
      check (kind not in ('status_change', 'backfill') or to_status is not null);
  end if;
end $$;

create index if not exists lead_events_kind_idx on lead_events (lead_id, kind);

-- ─── lead_events: editable when, immutable what ──────────────────────────────

create or replace function lead_events_append_only()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    -- Still allowed as part of deleting the whole lead (see 004).
    if not exists (select 1 from leads where id = old.lead_id) then
      return old;
    end if;
    raise exception 'lead_events: an entry cannot be deleted while its lead exists'
      using errcode = 'CR006';
  end if;

  -- UPDATE. Correcting a backfilled date, or rewording a note, is legitimate —
  -- rewriting which status change took place is not. Everything that describes
  -- *what happened* is frozen; occurred_at and note are free.
  if new.id          is distinct from old.id
  or new.lead_id     is distinct from old.lead_id
  or new.from_status is distinct from old.from_status
  or new.to_status   is distinct from old.to_status
  or new.kind        is distinct from old.kind then
    raise exception 'lead_events: only the date and the note can be edited'
      using errcode = 'CR006';
  end if;

  return new;
end;
$$ language plpgsql;

-- 001 created these as row triggers on update and delete; both still apply.
drop trigger if exists lead_events_no_update on lead_events;
create trigger lead_events_no_update
  before update on lead_events
  for each row execute function lead_events_append_only();

drop trigger if exists lead_events_no_delete on lead_events;
create trigger lead_events_no_delete
  before delete on lead_events
  for each row execute function lead_events_append_only();

-- ─── The status guard, relaxed ───────────────────────────────────────────────

create or replace function leads_guard_status_change()
returns trigger as $$
declare
  v_note             text;
  v_at               timestamptz;
  v_backfill         boolean;
  v_is_hard_terminal boolean;
begin
  v_backfill := coalesce(current_setting('crm.backfill', true), '') = 'on';

  -- 1 ── the move must be allowed, unless this is an explicit correction
  if not v_backfill and not exists (
    select 1 from lead_status_transitions
    where from_status = old.status
      and to_status   = new.status
  ) then
    raise exception 'Nem megengedett státuszváltás: % → %', old.status, new.status
      using errcode = 'CR001',
            hint    = 'A megengedett lépések a lead_status_transitions táblában vannak.';
  end if;

  -- 2 ── (removed) next_action_at is optional, and may be in the past.

  -- 3 ── closing a lead still requires saying why
  if new.status in ('LOST', 'DISQUALIFIED', 'UNREACHABLE') then
    if new.lost_reason is null or btrim(new.lost_reason) = '' then
      raise exception '% státuszhoz kötelező az indoklás', new.status
        using errcode = 'CR004';
    end if;
  end if;

  -- 4 ── hard terminals carry no future work
  select not exists (
    select 1 from lead_status_transitions where from_status = new.status
  ) into v_is_hard_terminal;

  if v_is_hard_terminal then
    new.next_action_at := null;
  end if;

  -- 5 ── every move still leaves a trace
  v_note := nullif(btrim(coalesce(current_setting('crm.transition_note', true), '')), '');
  v_at   := nullif(btrim(coalesce(current_setting('crm.event_at', true), '')), '')::timestamptz;

  insert into lead_events (lead_id, from_status, to_status, kind, note, occurred_at)
  values (
    new.id,
    old.status,
    new.status,
    case when v_backfill then 'backfill' else 'status_change' end,
    v_note,
    coalesce(v_at, now())
  );

  return new;
end;
$$ language plpgsql;

-- ─── Backfill: move a lead anywhere, on the record ───────────────────────────

create or replace function crm_backfill_lead_status(
  p_lead_id     uuid,
  p_to_status   lead_status,
  p_note        text        default null,
  p_occurred_at timestamptz default null,
  p_lost_reason text        default null
)
returns leads
language plpgsql
as $$
declare
  v_lead leads;
begin
  -- Transaction-scoped, so the escape cannot leak into the next statement on a
  -- pooled connection. This is the only thing that lifts the edge check, and it
  -- is set nowhere else.
  perform set_config('crm.backfill', 'on', true);
  perform set_config('crm.transition_note', coalesce(p_note, ''), true);
  perform set_config('crm.event_at', coalesce(p_occurred_at::text, ''), true);

  update leads
     set status      = p_to_status,
         lost_reason = coalesce(p_lost_reason, lost_reason)
   where id = p_lead_id
  returning * into v_lead;

  if not found then
    raise exception 'Lead nem található: %', p_lead_id using errcode = 'CR005';
  end if;

  return v_lead;
end;
$$;

revoke all on function crm_backfill_lead_status(uuid, lead_status, text, timestamptz, text)
  from public, anon, authenticated;

-- ─── Activity entries ────────────────────────────────────────────────────────
--
-- Inserted directly by the app rather than through an RPC: lead_events accepts
-- inserts, and there are no cross-table rules to hold together here.
-- Logging a call also bumps the lead's attempt counter, which is why this is a
-- function rather than a bare insert.

create or replace function crm_log_activity(
  p_lead_id     uuid,
  p_kind        text,
  p_note        text        default null,
  p_occurred_at timestamptz default null
)
returns lead_events
language plpgsql
as $$
declare
  v_event lead_events;
begin
  if p_kind not in ('note', 'call', 'email', 'meeting') then
    raise exception 'Unknown activity kind: %', p_kind using errcode = 'CR008';
  end if;

  if not exists (select 1 from leads where id = p_lead_id) then
    raise exception 'Lead nem található: %', p_lead_id using errcode = 'CR005';
  end if;

  insert into lead_events (lead_id, from_status, to_status, kind, note, occurred_at)
  values (p_lead_id, null, null, p_kind, nullif(btrim(coalesce(p_note, '')), ''),
          coalesce(p_occurred_at, now()))
  returning * into v_event;

  -- The attempt counter tracks chasing specifically, so only calls move it.
  if p_kind = 'call' then
    update leads
       set contact_attempts = contact_attempts + 1,
           last_attempt_at  = coalesce(p_occurred_at, now())
     where id = p_lead_id;
  end if;

  return v_event;
end;
$$;

revoke all on function crm_log_activity(uuid, text, text, timestamptz)
  from public, anon, authenticated;
