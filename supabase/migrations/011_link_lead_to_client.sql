-- Attach an existing lead to an existing client, and back out again.
--
-- Run after 006_convert_lead_to_client.sql. Safe to re-run.
--
-- Converting a lead creates the client and moves the lead in one go, which is
-- right when the two happen together. It is no help when they did not: a client
-- entered before the CRM existed, or a lead dragged to Customer on the board
-- with no revenue attached. Both leave a client and a lead that plainly belong
-- to each other and no way to say so.
--
-- This says so. It writes mrr_clients.lead_id and nothing else — in particular
-- it cannot reach crm_transition_lead, so attaching can never move a lead
-- through the pipeline as a side effect. The lead has to already be a customer,
-- which is the CRM's job to record and a drag away on the board.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- ─── crm_link_lead_to_client ─────────────────────────────────────────────────

create or replace function crm_link_lead_to_client(
  p_client_id uuid,
  p_lead_id   uuid
)
returns mrr_clients
language plpgsql
as $$
declare
  v_client mrr_clients;
  v_status lead_status;
begin
  -- Detaching. The lead keeps its status: a client that stops being attributed
  -- to a lead is not a lead that stops being a customer, and guessing which
  -- status to put it back to would be inventing history.
  if p_lead_id is null then
    update mrr_clients
       set lead_id = null, updated_at = now()
     where id = p_client_id
    returning * into v_client;

    if not found then
      raise exception 'Client not found' using errcode = 'CR005';
    end if;
    return v_client;
  end if;

  select status into v_status from leads where id = p_lead_id;
  if not found then
    raise exception 'Lead not found' using errcode = 'CR005';
  end if;

  -- The whole point of the restriction: linking is a statement about a lead
  -- that has already converted, not a way of converting one. Anything else
  -- would make this a second, quieter path into CONVERTED that skips both the
  -- transition table and the revenue the real path collects.
  if v_status <> 'CONVERTED' then
    raise exception 'Lead % is % , not CONVERTED', p_lead_id, v_status
      using errcode = 'CR009';
  end if;

  -- A lead already attached elsewhere trips mrr_clients_lead_id_key from 005,
  -- which surfaces as 23505 and is already mapped in the app.
  update mrr_clients
     set lead_id = p_lead_id, updated_at = now()
   where id = p_client_id
  returning * into v_client;

  if not found then
    raise exception 'Client not found' using errcode = 'CR005';
  end if;

  return v_client;
end;
$$;

-- Service role only, matching crm_transition_lead and crm_convert_lead_to_client.
-- mrr_clients is anon-readable, so this being callable by anon would be a way to
-- write lead_id from the browser with none of the above applied.
revoke all on function crm_link_lead_to_client(uuid, uuid)
  from public, anon, authenticated;

-- ─── Why crm_convert_lead_to_client is not touched here ──────────────────────
--
-- An earlier draft of this migration re-declared it, to skip the transition
-- when the lead was already CONVERTED. That was based on a wrong belief: that
-- converting an already-converted lead would fail with CR001, since CONVERTED
-- has no self-edge.
--
-- It does not. The guard trigger from 002 carries
-- `when (old.status is distinct from new.status)`, so a CONVERTED lead being
-- "moved" to CONVERTED never fires it — no edge is checked and no timeline
-- entry is written. Verified against the live database before this was removed.
--
-- So the amendment bought nothing, and re-declaring a function that belongs to
-- 006 would have left two migrations owning it, which is how the two drift.

-- ─── Check ───────────────────────────────────────────────────────────────────
--
-- Read-only: it picks a lead that is already in the wrong state and confirms it
-- is refused. Nothing is inserted, because a migration that writes a throwaway
-- row into a live table to test itself is a migration that can leave one behind.

do $$
declare
  v_lead   uuid;
  v_client uuid;
begin
  select id into v_lead   from leads where status <> 'CONVERTED' limit 1;
  select id into v_client from mrr_clients limit 1;

  if v_lead is null or v_client is null then
    raise notice 'crm_link_lead_to_client installed (nothing to test it against)';
    return;
  end if;

  begin
    perform crm_link_lead_to_client(v_client, v_lead);
    raise exception 'a lead that is not a customer was accepted';
  exception
    when sqlstate 'CR009' then
      raise notice 'crm_link_lead_to_client refuses leads that are not customers';
  end;
end $$;
