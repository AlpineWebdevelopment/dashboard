-- CRM lead management — schema (Gate 1)
--
-- Target: the dashboard's own Supabase project (figvcskjslkvomoxubuq).
-- The atrium-crm project (wqogqksfnlzgdzgfflpy) is deliberately NOT touched —
-- the Atrium website writes its bookings there and keeps owning that data.
--
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- This file is schema only. The state-machine guard trigger lives in
-- 002_lead_status_guards.sql so the two can be reviewed and reverted apart.

-- ─── lead_status ─────────────────────────────────────────────────────────────
-- 15 states. Kinds, for reference (not encoded here — the transition table is
-- what actually decides what is reachable):
--   active   NEW CONTACTING MEETING_BOOKED MEETING_CALL QUALIFIED DEMO_CALL
--            DEMO_BOOKED CONTRACT_CALL CONTRACT_MEET DECISION_PENDING
--   parked   NURTURE
--   terminal CONVERTED LOST DISQUALIFIED UNREACHABLE
-- Hungarian labels are NOT stored here — they live in src/lib/lead-status.ts.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type lead_status as enum (
      'NEW',
      'CONTACTING',
      'MEETING_BOOKED',
      'MEETING_CALL',
      'QUALIFIED',
      'DEMO_CALL',
      'DEMO_BOOKED',
      'CONTRACT_CALL',
      'CONTRACT_MEET',
      'DECISION_PENDING',
      'NURTURE',
      'CONVERTED',
      'LOST',
      'DISQUALIFIED',
      'UNREACHABLE'
    );
  end if;
end $$;

-- ─── leads ───────────────────────────────────────────────────────────────────

create table if not exists leads (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  status            lead_status not null default 'NEW',

  -- Nullable: a Meta lead-ad row carries a person, not a company. Screens fall
  -- back to contact_name when this is empty, so a lead is never nameless in the
  -- worklist just because the form never asked which company they run.
  company_name      text,
  contact_name      text,
  phone             text,
  email             text,

  -- Free text for now: kivitelezés, szépségipar, fogászat, általános…
  -- Deliberately not an enum — the list is still moving.
  niche             text,
  source            text,

  -- Bumped by the app on every call attempt; the worklist shows it so a lead
  -- that has been chased six times is visible as such.
  contact_attempts  int not null default 0,
  last_attempt_at   timestamptz,

  -- The spine of the worklist. Guarded on entry to the rot-prone states by
  -- the Gate 2 trigger, not by a column constraint — it is legitimately null
  -- for a lead sitting in NEW.
  next_action_at    timestamptz,

  lost_reason       text,
  notes             text
);

-- ─── Meta lead-ad import columns ─────────────────────────────────────────────
-- Additions beyond the Gate 1 column list, for the CSV import
-- (Created, Name, Email, Source, Form, Channel, Stage, Owner, Labels, Phone,
--  Secondary phone number, WhatsApp number).
-- Added with ALTER so an existing leads table picks them up on re-run.
--
-- Column mapping, for the importer:
--   Created                → created_at
--   Name                   → contact_name
--   Email                  → email
--   Source                 → source
--   Form                   → meta_form
--   Channel                → meta_channel
--   Stage                  → meta_stage        (raw, NEVER mapped onto status)
--   Owner                  → meta_owner
--   Labels                 → labels
--   Phone                  → phone
--   Secondary phone number → phone_secondary
--   WhatsApp number        → phone_whatsapp

-- Idempotent: fixes up a leads table created by an earlier run of this file,
-- when company_name was still NOT NULL.
alter table leads alter column company_name drop not null;

alter table leads add column if not exists meta_form       text;
alter table leads add column if not exists meta_channel    text;
-- Meta's own pipeline stage as exported. Kept verbatim and kept separate from
-- `status`: their vocabulary is not ours, and silently coercing it would put
-- leads into states this CRM's transition table never approved. Every imported
-- lead starts at NEW regardless of what this says.
alter table leads add column if not exists meta_stage      text;
alter table leads add column if not exists meta_owner      text;
alter table leads add column if not exists labels          text[] not null default '{}';
alter table leads add column if not exists phone_secondary text;
alter table leads add column if not exists phone_whatsapp  text;

-- ─── Lead form answers ───────────────────────────────────────────────────────
-- The pasted "Form answers" block, parsed. Shape:
--   {
--     "lead_form_id": "1560776142415870",
--     "submitted_at": "2026-08-13T14:53:00+02:00",
--     "answers": [
--       { "question": "Futtattatsz jelenleg fizetett hirdetést?",
--         "answer": "Igen, rendszeresen" },
--       …
--     ]
--   }
-- `answers` is an ordered array, not an object, so the detail page can render
-- the questions in the order the lead actually saw them — and so two questions
-- with the same text do not collide.
alter table leads add column if not exists form_answers jsonb;

-- The original pasted text, kept verbatim. The parser is best-effort against a
-- format Meta controls; when it mis-reads something, this is what lets us
-- re-parse historical rows instead of asking for the paste again.
alter table leads add column if not exists form_answers_raw text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_form_answers_is_object'
  ) then
    alter table leads add constraint leads_form_answers_is_object
      check (form_answers is null or jsonb_typeof(form_answers) = 'object');
  end if;
end $$;

-- ─── lead_status_transitions ─────────────────────────────────────────────────
-- The allowed edges as data. This table is the single source of truth: the
-- Gate 2 trigger reads it to accept or reject a move, and the UI reads it to
-- decide which options to render. The edge list is not repeated in TypeScript.

create table if not exists lead_status_transitions (
  from_status lead_status not null,
  to_status   lead_status not null,
  primary key (from_status, to_status)
);

insert into lead_status_transitions (from_status, to_status)
select f::lead_status, t::lead_status
from (values
  -- NEW: either we start working it, or it was never our market.
  ('NEW',              'CONTACTING'),
  ('NEW',              'DISQUALIFIED'),

  ('CONTACTING',       'MEETING_BOOKED'),
  ('CONTACTING',       'UNREACHABLE'),
  ('CONTACTING',       'LOST'),
  ('CONTACTING',       'DISQUALIFIED'),
  ('CONTACTING',       'NURTURE'),

  -- MEETING_CALL is the no-show for MEETING_BOOKED: back one step, never
  -- forward to QUALIFIED.
  ('MEETING_BOOKED',   'QUALIFIED'),
  ('MEETING_BOOKED',   'MEETING_CALL'),
  ('MEETING_BOOKED',   'LOST'),
  ('MEETING_BOOKED',   'DISQUALIFIED'),
  ('MEETING_BOOKED',   'NURTURE'),

  ('MEETING_CALL',     'MEETING_BOOKED'),
  ('MEETING_CALL',     'LOST'),
  ('MEETING_CALL',     'UNREACHABLE'),
  ('MEETING_CALL',     'DISQUALIFIED'),
  ('MEETING_CALL',     'NURTURE'),

  -- Straight to _BOOKED / _MEET when the next meeting was booked in the room,
  -- to the _CALL variant when it was not.
  ('QUALIFIED',        'DEMO_CALL'),
  ('QUALIFIED',        'DEMO_BOOKED'),
  ('QUALIFIED',        'CONTRACT_CALL'),
  ('QUALIFIED',        'CONTRACT_MEET'),
  ('QUALIFIED',        'LOST'),
  ('QUALIFIED',        'DISQUALIFIED'),
  ('QUALIFIED',        'NURTURE'),

  ('DEMO_CALL',        'DEMO_BOOKED'),
  ('DEMO_CALL',        'LOST'),
  ('DEMO_CALL',        'UNREACHABLE'),
  ('DEMO_CALL',        'NURTURE'),

  ('DEMO_BOOKED',      'CONTRACT_MEET'),
  ('DEMO_BOOKED',      'CONTRACT_CALL'),
  ('DEMO_BOOKED',      'DECISION_PENDING'),
  ('DEMO_BOOKED',      'CONVERTED'),
  ('DEMO_BOOKED',      'DEMO_CALL'),
  ('DEMO_BOOKED',      'LOST'),
  ('DEMO_BOOKED',      'NURTURE'),

  ('CONTRACT_CALL',    'CONTRACT_MEET'),
  ('CONTRACT_CALL',    'LOST'),
  ('CONTRACT_CALL',    'UNREACHABLE'),
  ('CONTRACT_CALL',    'NURTURE'),

  ('CONTRACT_MEET',    'CONVERTED'),
  ('CONTRACT_MEET',    'DECISION_PENDING'),
  ('CONTRACT_MEET',    'CONTRACT_CALL'),
  ('CONTRACT_MEET',    'LOST'),
  ('CONTRACT_MEET',    'NURTURE'),

  ('DECISION_PENDING', 'CONVERTED'),
  ('DECISION_PENDING', 'CONTRACT_MEET'),
  ('DECISION_PENDING', 'LOST'),
  ('DECISION_PENDING', 'NURTURE'),

  -- Soft terminals — reopenable. CONVERTED and DISQUALIFIED are hard and
  -- appear as `from_status` nowhere in this table.
  ('NURTURE',          'CONTACTING'),
  ('LOST',             'NURTURE'),
  ('UNREACHABLE',      'CONTACTING')
) as v(f, t)
on conflict (from_status, to_status) do nothing;

-- ─── lead_events ─────────────────────────────────────────────────────────────
-- Append-only audit log. Written by the Gate 2 trigger on every status change,
-- so a lead cannot move without leaving a trace.

create table if not exists lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  from_status lead_status,   -- null only for a row describing lead creation
  to_status   lead_status not null,
  occurred_at timestamptz not null default now(),
  note        text
);

-- Append-only, enforced with a trigger rather than RLS alone.
--
-- Why not RLS: this app reaches Postgres with the service role, and the
-- service role carries BYPASSRLS. An RLS policy would therefore stop the
-- browser (which cannot reach these tables at all) while doing nothing about
-- the one caller that can actually issue an UPDATE. A trigger holds for every
-- role, including the one we use.
--
-- Deviation from the gate spec, which asked for "RLS and/or a rule": a rule
-- with DO INSTEAD NOTHING would swallow the write and report success. Raising
-- is louder and easier to debug.
create or replace function lead_events_append_only()
returns trigger as $$
begin
  raise exception 'lead_events is append-only: % is not permitted', tg_op;
end;
$$ language plpgsql;

drop trigger if exists lead_events_no_update on lead_events;
create trigger lead_events_no_update
  before update on lead_events
  for each row execute function lead_events_append_only();

drop trigger if exists lead_events_no_delete on lead_events;
create trigger lead_events_no_delete
  before delete on lead_events
  for each row execute function lead_events_append_only();
-- Note: the FK above is ON DELETE CASCADE, but the delete trigger fires first
-- and aborts it — deleting a lead with events raises. Deliberate: the audit log
-- outranks convenience. Retiring a lead is a status change, not a delete.

-- ─── updated_at ──────────────────────────────────────────────────────────────

create or replace function leads_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_updated_at on leads;
create trigger leads_updated_at
  before update on leads
  for each row execute function leads_set_updated_at();

-- ─── indexes ─────────────────────────────────────────────────────────────────

-- The worklist's default sort: due soonest first, nulls last.
create index if not exists leads_next_action_at_idx
  on leads (next_action_at asc nulls last);
create index if not exists leads_status_idx     on leads (status);
create index if not exists leads_niche_idx      on leads (niche);
create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists lead_events_lead_id_idx
  on lead_events (lead_id, occurred_at desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- RLS on, and no policy for anon or authenticated — those roles get nothing.
--
-- This dashboard does not use Supabase Auth (middleware.ts verifies its own
-- HMAC `gt_session` cookie), so auth.uid() is always null here and a
-- "USING (auth.uid() is not null)" policy would lock the app out of its own
-- tables. Access is server-side only, through the service role, behind that
-- middleware. No policies are needed for it — the service role bypasses RLS.

alter table leads                   enable row level security;
alter table lead_status_transitions enable row level security;
alter table lead_events             enable row level security;
