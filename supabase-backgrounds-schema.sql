-- ============================================================
-- Background images — run once in the Supabase SQL Editor.
-- Safe to re-run: everything uses IF NOT EXISTS / ON CONFLICT.
-- ============================================================

-- ── App settings (single row, same shape as scratch_pad) ─────
create table if not exists app_settings (
  id              int primary key default 1,
  background_url  text,
  background_dim  real not null default 0.55,
  background_blur real not null default 0,
  updated_at      timestamp with time zone default now() not null,
  constraint app_settings_single_row check (id = 1)
);

insert into app_settings (id) values (1) on conflict do nothing;

alter table app_settings enable row level security;
drop policy if exists "Allow all" on app_settings;
create policy "Allow all" on app_settings for all using (true) with check (true);

-- ── Storage bucket holding the uploaded images ───────────────
-- Public so the browser can render the image straight from the CDN
-- without signing every URL. 10 MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'backgrounds',
  'backgrounds',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Uploads happen straight from the browser with the anon key, so the
-- policies stay open — the whole app already sits behind the password
-- gate in middleware.ts.
drop policy if exists "backgrounds read"   on storage.objects;
drop policy if exists "backgrounds insert" on storage.objects;
drop policy if exists "backgrounds update" on storage.objects;
drop policy if exists "backgrounds delete" on storage.objects;

create policy "backgrounds read" on storage.objects
  for select using (bucket_id = 'backgrounds');
create policy "backgrounds insert" on storage.objects
  for insert with check (bucket_id = 'backgrounds');
create policy "backgrounds update" on storage.objects
  for update using (bucket_id = 'backgrounds') with check (bucket_id = 'backgrounds');
create policy "backgrounds delete" on storage.objects
  for delete using (bucket_id = 'backgrounds');
