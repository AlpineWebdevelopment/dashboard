-- One lead, several paid jobs.
--
-- Run after 011_link_lead_to_client.sql. Safe to re-run.
--
-- Migration 005 wrote down a rule that only holds for the first sale: "One lead
-- becomes at most one client", enforced with a partial unique index on
-- mrr_clients.lead_id. A customer who signs for a website, then a separate SEO
-- retainer, then a one-off landing page is three billing arrangements with three
-- dates, three fees and three end dates — three mrr_clients rows — belonging to
-- one lead. The index made the second one unrecordable against that lead: it had
-- to be typed in unattached, which is exactly the lost trail 005 existed to stop.
--
-- Dropping the index is the whole schema change. Nothing else about the link has
-- to move: mrr_clients.lead_id still points at exactly one lead, ON DELETE SET
-- NULL is still the right answer for a deleted lead, and crm_link_lead_to_client
-- still refuses anything that is not already a customer.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- ─── Lift the one-client-per-lead cap ────────────────────────────────────────

-- mrr_clients_lead_id_idx, the plain index from 005, is deliberately left alone.
-- It mattered less when a lead matched at most one row; it matters more now that
-- "every job for this customer" is a real lookup returning several.
drop index if exists mrr_clients_lead_id_key;

-- ─── crm_convert_lead_to_client ──────────────────────────────────────────────
--
-- Declared in 006 and amended here; 012 owns it from now on. The signature and
-- every rule in it are unchanged. What is added is the note handling below.

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
  v_before lead_status;
begin
  v_input := jsonb_populate_record(null::mrr_clients, p_client);

  -- Defence in depth; the server action validates with Zod before reaching here.
  if v_input.name is null or btrim(v_input.name) = '' then
    raise exception 'Client name is required' using errcode = 'CR007';
  end if;
  if v_input.start_date is null then
    raise exception 'Start date is required' using errcode = 'CR007';
  end if;

  -- Read before moving, because after the transition every lead looks the same.
  select status into v_before from leads where id = p_lead_id;
  if not found then
    raise exception 'Lead nem található: %', p_lead_id using errcode = 'CR005';
  end if;

  -- The lead moves first, so business rules decide before anything is inserted.
  --
  -- Routed through crm_transition_lead rather than a local UPDATE on purpose:
  -- that function stays the only thing in the database that writes leads.status,
  -- which is what keeps the guard trigger, the audit row and the note handling
  -- in exactly one place. It raises CR001 if this lead cannot legally reach
  -- CONVERTED, and CR005 if it does not exist.
  perform crm_transition_lead(p_lead_id, 'CONVERTED'::lead_status, null, null, p_note);

  -- A lead that was already a customer did not move, so the guard trigger — which
  -- fires only `when (old.status is distinct from new.status)` — wrote no
  -- lead_events row, and p_note went nowhere with it.
  --
  -- That was harmless while this branch was a rarity reachable only by a lead
  -- dragged to Customer by hand. Since the unique index came off above it is the
  -- ordinary path: every job a customer buys after the first arrives here, and
  -- leaving it silent would mean a lead's history records the first sale and none
  -- of the ones after it. Written as a plain note rather than a status entry,
  -- because nothing about the lead's position changed.
  if v_before = 'CONVERTED' and nullif(btrim(coalesce(p_note, '')), '') is not null then
    perform crm_log_activity(p_lead_id, 'note', p_note);
  end if;

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

-- ─── Check ───────────────────────────────────────────────────────────────────
--
-- Read-only. Nothing is inserted: a migration that writes a throwaway row into a
-- live table to test itself is a migration that can leave one behind.

do $$
declare
  v_max int;
begin
  if exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'mrr_clients_lead_id_key'
  ) then
    raise exception 'mrr_clients_lead_id_key is still present — a lead is still capped at one client';
  end if;

  if to_regclass('public.mrr_clients_lead_id_idx') is null then
    raise warning 'mrr_clients_lead_id_idx is missing — lookups by lead will sequential-scan';
  end if;

  select coalesce(max(n), 0) into v_max
    from (select count(*) as n from mrr_clients where lead_id is not null group by lead_id) c;

  raise notice 'a lead may now hold several clients (busiest lead currently holds %)', v_max;
end $$;
