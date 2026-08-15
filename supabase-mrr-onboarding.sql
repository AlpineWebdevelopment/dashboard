-- MRR v2: two-stage setup payment (50% at contract, 50% at go-live).
-- Run this AFTER supabase-mrr-schema.sql if the mrr_clients table already existed
-- before these columns were added. Idempotent — safe to run either way.

alter table mrr_clients add column if not exists golive_date date;
alter table mrr_clients add column if not exists first_billing_date date;

-- Existing rows were entered as already-live clients
update mrr_clients set golive_date = start_date where golive_date is null and kind = 'recurring';
