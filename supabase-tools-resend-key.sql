-- Move each sender's Resend API key into the database, and retire the env
-- indirection it replaces.
--
-- Run this in the SQL editor of the dashboard's OWN Supabase project — check the
-- project name in the top-left first (figvcskjslkvomoxubuq).
--
-- Safe to re-run, and safe to run again if you already ran the earlier version
-- of this file: the ADD is a no-op once the column exists, and the DROP is the
-- only new statement.
--
-- Until now an account stored `resend_key_ref`, a slug naming the env var
-- RESEND_KEY_<REF> that held the real key. Those variables belonged to the old
-- Vercel projects these tools came from and do not exist in this one, so the
-- slug resolved to nothing and every send failed. The key itself lives here now,
-- edited under Manage → Accounts, and it is the only source — there is no
-- fallback, so an account without a key cannot send.
--
-- On exposure: nothing reaches this table from the browser.
-- /api/tools/email/accounts strips `resend_api_key` from every response and
-- reports a `has_resend_key` boolean instead, so the manager can show whether a
-- key is set without ever receiving it. The only read is in
-- /api/tools/send-email. RLS is already on for this table with no policy, so the
-- anon key cannot see it either way — this column is the reason to keep it so.

alter table public.email_accounts
  add column if not exists resend_api_key text;

comment on column public.email_accounts.resend_api_key is
  'Resend API key for this sender. Write-only over the API: never returned to '
  'the browser, read only by /api/tools/send-email.';

-- The slug is dead once the key is stored here: nothing in the app reads it any
-- more, and the env vars it pointed at are gone.
alter table public.email_accounts
  drop column if exists resend_key_ref;

-- PostgREST caches the schema; without this the API keeps answering with the old
-- column list until it happens to reload on its own.
select pg_notify('pgrst', 'reload schema');
