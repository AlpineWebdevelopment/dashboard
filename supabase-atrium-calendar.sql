-- The Atrium CRM booking calendar: available hours, appointments, blocks.
--
-- Run this in the SQL editor of the dashboard's OWN Supabase project — check
-- the project name in the top-left before running. This is the project the CRM
-- leads already live in (figvcskjslkvomoxubuq), NOT the standalone atrium-crm
-- project; the two stay separate databases on purpose.
--
-- Everything is prefixed `crm_` because this project already has a calendar of
-- its own (the /cal page, `events`). An unprefixed `calendar_settings` here
-- would read as that one's.
--
-- Safe to re-run: every statement is guarded, and the settings row is only
-- seeded when it is missing, so a second run never overwrites your hours.

-- ---------- crm_calendar_settings (single config row) ----------
create table if not exists public.crm_calendar_settings (
  id                    uuid primary key default '00000000-0000-0000-0000-000000000001',
  slot_duration_minutes int  not null default 30,
  buffer_before_minutes int  not null default 0,
  buffer_after_minutes  int  not null default 30,
  min_notice_minutes    int  not null default 30,    -- earliest bookable = now + this
  booking_window_days   int  not null default 2,     -- how far ahead bookings are allowed
  fake_busy_percent     int  not null default 30,    -- 0-100: hide this % of open slots
  timezone              text not null default 'Europe/Budapest',
  -- Weekly available hours: keys "0" (Sun) .. "6" (Sat), each an array of
  -- [from, to] "HH:MM" ranges. A day with no entry has no bookable slots.
  -- The settings screen writes one range per day; more than one is honoured by
  -- the engine (a lunch break splits a day) but would be flattened by the next
  -- save from that screen.
  availability          jsonb not null default
    '{"0":[["10:00","21:00"]],"1":[["10:00","21:00"]],"2":[["10:00","21:00"]],"3":[["10:00","21:00"]],"4":[["10:00","21:00"]],"5":[["10:00","21:00"]],"6":[["10:00","21:00"]]}',
  updated_at            timestamptz not null default now()
);

-- The singleton. Seeded to match what the standalone atrium-crm was serving on
-- 2026-08-20, so the calendar opens configured rather than empty.
insert into public.crm_calendar_settings (id) values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ---------- crm_appointments (a booked slot, always tied to a lead) ----------
create table if not exists public.crm_appointments (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads(id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     text not null default 'booked'
             check (status in ('booked','cancelled','completed','no_show')),
  created_at timestamptz not null default now()
);
create index if not exists crm_appointments_starts_at_idx on public.crm_appointments(starts_at);
create index if not exists crm_appointments_lead_id_idx   on public.crm_appointments(lead_id);

-- ---------- crm_manual_blocks (time you have blocked out by hand) ----------
create table if not exists public.crm_manual_blocks (
  id         uuid primary key default gen_random_uuid(),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists crm_manual_blocks_starts_at_idx on public.crm_manual_blocks(starts_at);

-- ---------- crm_slot_overrides (fake-busy slots forced back open) ----------
-- One row per slot that the scarcity dial hid and you have since unlocked.
create table if not exists public.crm_slot_overrides (
  slot_start timestamptz primary key,
  created_at timestamptz not null default now()
);

-- ---------- crm_day_fake_pins (freeze a day's fake-busy %) ----------
-- Written the first time a day is touched by hand, so that later changes to the
-- global percentage cannot reshuffle which slots that day was already showing.
create table if not exists public.crm_day_fake_pins (
  day          date primary key,
  fake_percent int not null,
  created_at   timestamptz not null default now()
);

-- ---------- Row Level Security ----------
-- Same posture as the rest of the CRM tables: RLS on with no policy at all, so
-- the anon key in the browser sees nothing. Every read and write goes through
-- the service-role key server-side (src/lib/crm/db.ts), which bypasses RLS.
alter table public.crm_calendar_settings enable row level security;
alter table public.crm_appointments      enable row level security;
alter table public.crm_manual_blocks     enable row level security;
alter table public.crm_slot_overrides    enable row level security;
alter table public.crm_day_fake_pins     enable row level security;

-- PostgREST caches the schema; without this the API keeps answering with the
-- old table list until it happens to reload on its own.
select pg_notify('pgrst', 'reload schema');
