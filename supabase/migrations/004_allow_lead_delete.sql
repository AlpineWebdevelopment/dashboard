-- CRM lead management — let a lead be deleted, without weakening the audit log.
--
-- Run after 003_transition_rpc.sql. Safe to re-run.
--
-- The problem this fixes: 001 blocks every DELETE on lead_events. leads has an
-- ON DELETE CASCADE to it, so once a lead had moved status even once, deleting
-- that lead raised. A mis-parsed CSV import, a duplicate, or a spam lead was
-- therefore permanent.
--
-- The distinction that matters is tampering vs. removal:
--
--   Deleting one event row while its lead lives on   → rewriting history. Refused.
--   Deleting the lead itself                         → removing the whole record,
--                                                      history included. Allowed.
--
-- A cascading delete is told apart from a direct one by looking for the parent.
-- Postgres applies the referential action after the parent row is gone, so
-- inside the cascade the lead is already absent from this transaction's view,
-- while a hand-written "delete from lead_events" still sees it.
--
-- UPDATE stays refused in every case: there is no legitimate reason to edit an
-- event that has already been written.

-- ─── Wrong-database guard ────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.ongoing_activities') is null then
    raise exception
      'Wrong database: this migration is for the dashboard project (figvcskjslkvomoxubuq), which has an ongoing_activities table. Check which project the SQL editor is pointed at.';
  end if;
end $$;

-- ─── Append-only, with a door for whole-lead deletion ────────────────────────

create or replace function lead_events_append_only()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from leads where id = old.lead_id) then
      return old;  -- the lead is going too; its history goes with it
    end if;
    raise exception
      'lead_events is append-only: egy esemény nem törölhető, amíg a lead létezik'
      using errcode = 'CR006';
  end if;

  raise exception 'lead_events is append-only: % is not permitted', tg_op
    using errcode = 'CR006';
end;
$$ language plpgsql;

-- Triggers themselves are unchanged from 001; only the function body moved.
