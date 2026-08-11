-- ── Google Calendar sync ──────────────────────────────────────────────────────
-- Adds one-way sync (Google → Dashboard) for the Events calendar.
-- Safe to re-run.

-- ── Extra columns on the existing `events` table ──────────────────────────────
-- Manual events keep source='manual' and NULL google_* columns.
alter table events add column if not exists source            text    not null default 'manual';
alter table events add column if not exists google_event_id   text;
alter table events add column if not exists google_calendar_id text;
alter table events add column if not exists google_ical_uid   text;
alter table events add column if not exists google_etag       text;
alter table events add column if not exists google_html_link  text;
alter table events add column if not exists google_sync_run   text;
alter table events add column if not exists end_date          date;
alter table events add column if not exists end_time          text;
alter table events add column if not exists all_day           boolean not null default false;
alter table events add column if not exists location          text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'events_source_check') then
    alter table events add constraint events_source_check check (source in ('manual', 'google'));
  end if;
end$$;

-- One row per (calendar, event). Manual rows have NULLs in both columns and
-- Postgres treats NULLs as distinct, so they are unaffected by this index.
create unique index if not exists events_google_unique
  on events (google_calendar_id, google_event_id);

-- The sync reconcile pass scans by calendar + date window.
create index if not exists events_google_calendar_date_idx
  on events (google_calendar_id, date)
  where source = 'google';

-- ── Connected Google account (single-user dashboard → a single row) ───────────
create table if not exists google_accounts (
  id                     text primary key default 'default',
  email                  text not null default '',
  -- AES-256-GCM ciphertext, key derived from AUTH_SECRET. Never plaintext.
  refresh_token_enc      text not null,
  access_token_enc       text,
  access_token_expires_at timestamptz,
  scope                  text not null default '',
  time_zone              text not null default 'UTC',
  -- Shared secret echoed back by Google on every push notification.
  webhook_token          text not null default '',
  last_sync_at           timestamptz,
  last_sync_source       text not null default '',
  last_error             text,
  -- Bumped whenever a sync actually changed something. The UI polls this to
  -- know when to refetch, instead of refetching the whole month on a timer.
  sync_revision          bigint not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table google_accounts enable row level security;
drop policy if exists "Service role only" on google_accounts;
-- No policy for anon/authenticated: this table holds OAuth tokens and must only
-- ever be reached with the service role key, which bypasses RLS.

-- ── Calendars discovered on that account ──────────────────────────────────────
create table if not exists google_calendars (
  id             text primary key,           -- Google's calendar id (an email-ish string)
  account_id     text not null default 'default' references google_accounts(id) on delete cascade,
  summary        text not null default '',
  description    text not null default '',
  time_zone      text not null default 'UTC',
  color          text not null default 'sky', -- mapped into the dashboard palette
  primary_cal    boolean not null default false,
  sync_enabled   boolean not null default true,
  -- Hash of the last fetched event payload. Unchanged hash → skip all writes.
  content_hash   text,
  -- Push notification channel (only set when a public HTTPS APP_URL is configured).
  channel_id     text,
  channel_resource_id text,
  channel_expiration  timestamptz,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table google_calendars enable row level security;
drop policy if exists "Service role only" on google_calendars;

create index if not exists google_calendars_account_idx on google_calendars (account_id);
