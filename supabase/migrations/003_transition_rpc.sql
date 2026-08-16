-- CRM lead management — the one supported way to move a lead.
--
-- Run after 002_lead_status_guards.sql. Safe to re-run.
--
-- Why an RPC and not a plain UPDATE from the app:
--
-- The Gate 2 trigger writes the lead_events row itself, and reads the event's
-- note from a transaction-local setting (crm.transition_note). PostgREST runs
-- every request in its own transaction, so supabase-js cannot issue
-- set_config() and the UPDATE together — the setting would be gone by the time
-- the trigger looked for it. Wrapping both in one function fixes that and gives
-- the app a single, auditable entry point for status changes.
--
-- lib/crm/leads.ts calls this through .rpc('crm_transition_lead', …) and it is
-- the only place in the codebase that writes leads.status.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- ─── crm_transition_lead ─────────────────────────────────────────────────────

create or replace function crm_transition_lead(
  p_lead_id        uuid,
  p_to_status      lead_status,
  p_next_action_at timestamptz default null,
  p_lost_reason    text        default null,
  p_note           text        default null
)
returns leads
language plpgsql
as $$
declare
  v_lead leads;
begin
  -- Transaction-scoped (third arg true), so it cannot bleed into the next
  -- statement on a pooled connection.
  perform set_config('crm.transition_note', coalesce(p_note, ''), true);

  -- next_action_at falls back to what the lead already carries, so a move that
  -- does not concern the date leaves it alone. A stale value is still not a way
  -- through the guard: entering a date-requiring state with a past date is
  -- refused (CR003), and a hard terminal clears it regardless.
  --
  -- lost_reason deliberately does NOT fall back. It describes why the lead is
  -- closed *now*. Coalescing it would let a lead that was once LOST with a
  -- reason be reopened, worked, and closed again with no reason supplied —
  -- quietly reusing the old one and defeating guard CR004. Assigning the
  -- parameter straight through means closing always demands a fresh reason, and
  -- reopening clears the old one. Past reasons survive on the lead_events note.
  update leads
     set status         = p_to_status,
         next_action_at = coalesce(p_next_action_at, next_action_at),
         lost_reason    = p_lost_reason
   where id = p_lead_id
  returning * into v_lead;

  if not found then
    raise exception 'Lead nem található: %', p_lead_id using errcode = 'CR005';
  end if;

  return v_lead;
end;
$$;

-- Only the service role should reach this. It runs SECURITY INVOKER, so an anon
-- caller would already be stopped by RLS on leads, but revoking says so plainly.
revoke all on function crm_transition_lead(uuid, lead_status, timestamptz, text, text)
  from public, anon, authenticated;
