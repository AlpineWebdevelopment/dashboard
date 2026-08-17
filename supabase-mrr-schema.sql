-- MRR tracker: clients with recurring revenue + one-off part jobs.
-- Run this in the Supabase SQL editor.

create table if not exists mrr_clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text not null default '',
  -- 'recurring' = setup fee + monthly fee; 'oneoff' = part job, one-time income only (setup_fee holds the amount)
  kind text not null default 'recurring' check (kind in ('recurring', 'oneoff')),
  setup_fee numeric not null default 0,
  monthly_fee numeric not null default 0,
  monthly_description text not null default '',
  -- Contract date: first half of the setup fee is paid when the contract is signed
  start_date date not null,
  -- Go-live: second setup half is paid and monthly billing starts. Null = still onboarding.
  golive_date date,
  -- Rare override: monthly billing starts this month instead of the go-live month
  first_billing_date date,
  end_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table mrr_clients enable row level security;
create policy "Allow all" on mrr_clients for all using (true) with check (true);

create index if not exists mrr_clients_start_date_idx on mrr_clients (start_date);
create index if not exists mrr_clients_kind_idx on mrr_clients (kind);
