-- Link an MRR client back to the lead it came from.
--
-- Run after 004_allow_lead_delete.sql. Safe to re-run.
--
-- Until now the MRR page and the CRM knew nothing about each other: a lead that
-- signed was retyped into mrr_clients by hand, and nothing recorded that this
-- revenue came from that lead.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- ─── mrr_clients.lead_id ─────────────────────────────────────────────────────

-- ON DELETE SET NULL, not CASCADE: deleting a lead must never take a revenue
-- record with it. The money was still earned; only the trail back to the lead
-- is lost.
alter table mrr_clients
  add column if not exists lead_id uuid references leads(id) on delete set null;

-- One lead becomes at most one client. In practice the state machine already
-- prevents a second conversion — a lead that converted is CONVERTED, which is a
-- hard terminal with no outgoing edge, so crm_transition_lead refuses it with
-- CR001. This index is the backstop for the case that rule cannot see: a client
-- row deleted and the same lead assigned again.
create unique index if not exists mrr_clients_lead_id_key
  on mrr_clients (lead_id)
  where lead_id is not null;

create index if not exists mrr_clients_lead_id_idx on mrr_clients (lead_id);

-- Note on visibility: mrr_clients carries a permissive "Allow all" policy and is
-- read with the anon key, while leads is service-role only. Exposing lead_id
-- hands the browser a uuid and nothing else — the lead itself stays unreadable.
