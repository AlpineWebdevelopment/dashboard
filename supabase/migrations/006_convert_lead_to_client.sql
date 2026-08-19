-- Turn a lead into a paying client, atomically.
--
-- Run after 005_mrr_client_lead_link.sql. Safe to re-run.
--
-- Converting is two writes that must not come apart: the lead moves to
-- CONVERTED and an mrr_clients row appears pointing back at it. Doing them as
-- two PostgREST calls means each is its own transaction, so a refused
-- transition could still leave a client behind, or a failed insert could leave
-- a lead marked as a customer with no revenue attached to it.
--
-- Both happen here, in one transaction. If either fails, neither happened.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- ─── crm_convert_lead_to_client ──────────────────────────────────────────────
--
-- SUPERSEDED: 012_multiple_clients_per_lead.sql re-declares this function and
-- owns it now. Leaving the original below rather than editing it in place keeps
-- 006 a truthful record of what was applied at the time; 012 carries the current
-- body. Change one and you have two versions racing on whichever ran last, so
-- change 012.

create or replace function crm_convert_lead_to_client(
  p_lead_id uuid,
  p_client  jsonb,
  p_note    text default null
)
returns mrr_clients
language plpgsql
as $$
declare
  v_input  mrr_clients;
  v_client mrr_clients;
begin
  v_input := jsonb_populate_record(null::mrr_clients, p_client);

  -- Defence in depth; the server action validates with Zod before reaching here.
  if v_input.name is null or btrim(v_input.name) = '' then
    raise exception 'Client name is required' using errcode = 'CR007';
  end if;
  if v_input.start_date is null then
    raise exception 'Start date is required' using errcode = 'CR007';
  end if;

  -- The lead moves first, so business rules decide before anything is inserted.
  --
  -- Routed through crm_transition_lead rather than a local UPDATE on purpose:
  -- that function stays the only thing in the database that writes leads.status,
  -- which is what keeps the guard trigger, the audit row and the note handling
  -- in exactly one place. It raises CR001 if this lead cannot legally reach
  -- CONVERTED, and CR005 if it does not exist.
  perform crm_transition_lead(p_lead_id, 'CONVERTED'::lead_status, null, null, p_note);

  -- Columns are listed rather than inserting the populated record wholesale, so
  -- an id, a lead_id or a created_at arriving in p_client is ignored instead of
  -- overriding what this function decides.
  insert into mrr_clients (
    name, description, kind,
    setup_fee, monthly_fee, monthly_description,
    start_date, golive_date, first_billing_date, end_date,
    lead_id
  ) values (
    btrim(v_input.name),
    coalesce(v_input.description, ''),
    coalesce(v_input.kind, 'recurring'),
    coalesce(v_input.setup_fee, 0),
    coalesce(v_input.monthly_fee, 0),
    coalesce(v_input.monthly_description, ''),
    v_input.start_date,
    v_input.golive_date,
    v_input.first_billing_date,
    v_input.end_date,
    p_lead_id
  )
  returning * into v_client;

  return v_client;
end;
$$;

-- Service role only, matching crm_transition_lead. An anon caller would be
-- stopped by RLS on leads anyway; revoking says so out loud.
revoke all on function crm_convert_lead_to_client(uuid, jsonb, text)
  from public, anon, authenticated;
