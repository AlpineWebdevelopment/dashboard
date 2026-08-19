# Google Calendar sync

One-way sync: Google Calendar → the dashboard's **Events** calendar. Nothing is
ever written back to Google, and the OAuth scopes requested are read-only.

Changes reach the dashboard two ways:

- **Push** — Google calls `/api/google/webhook` the moment a calendar changes.
  Latency is typically a few seconds. Needs a public HTTPS URL.
- **Poll** — `/api/google/cron` runs on a schedule as a safety net, and renews
  the push channels before they expire (Google's channels are short-lived, so
  something has to run on a timer either way).

The browser picks changes up without a reload: the Events page polls a small
revision counter and refetches the visible month only when a sync actually
changed something.

---

## 1. The database

Nothing to run: `google_accounts`, `google_calendars` and the Google columns on
`events` are already in place on the dashboard's Supabase project. The schema
file that created them has been deleted along with the rest of the root `.sql`
files — the live database is the record now.

A brand-new Supabase project would need those two tables and the `events`
columns built by hand before the rest of this guide works.

## 2. Create Google OAuth credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create
   a project (or pick an existing one).
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → choose **External**, fill in the
   app name and your email. Leave it in *Testing* mode and add your own Google
   account under **Test users** — a personal dashboard never needs verification.
4. Add these scopes: `calendar.readonly`, `calendar.events.readonly`,
   `userinfo.email`.
5. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   **Web application**. Under **Authorised redirect URIs** add:
   - `https://your-domain.com/api/google/callback`
   - `http://localhost:3000/api/google/callback` (for local development)
6. Copy the **Client ID** and **Client secret**.

## 3. Set environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | yes | OAuth client ID from step 2 |
| `GOOGLE_CLIENT_SECRET` | yes | OAuth client secret from step 2 |
| `APP_URL` | for push | Public origin, e.g. `https://your-domain.com`. Pins the OAuth redirect and is the address Google pushes to. Without it, sync falls back to polling. |
| `CRON_SECRET` | for cron | Bearer token protecting `/api/google/cron`. Generate any long random string. Vercel Cron sends it automatically. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | The OAuth tokens live in a table with no anon-key policy, so the sync needs the service role. |
| `AUTH_SECRET` | yes | Already used for dashboard login; also derives the key that encrypts the stored Google refresh token. |
| `GOOGLE_SYNC_PAST_DAYS` | no | How far back to mirror. Default `120`. |
| `GOOGLE_SYNC_FUTURE_DAYS` | no | How far forward to mirror. Default `400`. |

> Changing `AUTH_SECRET` invalidates the stored Google token — reconnect the
> account afterwards.

## 4. Connect

Go to **Cal** in the dashboard. The panel below the grid shows a **Connect Google
Calendar** button. After the consent screen you land back on `/cal` with your
calendars listed and the first sync already done.

Each calendar has a checkbox. Calendars visible in Google are enabled by
default; unticking one removes its events from the dashboard immediately.

The badge in the panel reads **Live** when push notifications are registered and
**Polling** when they are not.

## 5. Scheduling the poll

`vercel.json` registers `/api/google/cron` once a day, at 04:00 UTC.

Daily is the default because **Vercel's Hobby plan rejects any cron schedule
more frequent than once a day and fails the deployment**. Once a day is enough
for the cron's main job — renewing the push channels before Google expires them
— and push notifications are what deliver changes in real time.

On a Pro plan you can tighten it to `*/5 * * * *` for a stronger polling
fallback. On Hobby, leave `vercel.json` alone and point an external scheduler at
the endpoint instead if you want more frequent polling:

```bash
curl -X POST https://your-domain.com/api/google/cron \
  -H "Authorization: Bearer $CRON_SECRET"
```

Point [cron-job.org](https://cron-job.org), a GitHub Actions schedule, or your
own box at that URL every few minutes.

---

## How it works

`syncAll()` re-reads the whole sync window for each enabled calendar on every
pass and reconciles it against the mirror, rather than using Google's
incremental `syncToken` protocol. That is slightly more traffic — one or two
HTTP requests per calendar — but it is self-healing: no token to invalidate, no
`410 Gone` recovery path, and an event that is deleted or dragged outside the
window can't leave a ghost row behind. A SHA-256 fingerprint of the fetched
event list is compared against the last one, so an unchanged calendar performs
no database writes at all and does not bump the revision counter.

Recurring events are expanded by Google (`singleEvents=true`), so each instance
becomes its own row. Times are converted to the owning calendar's timezone and
stored as wall-clock date + time, matching how hand-created events are stored.

### Security notes

- The refresh token is encrypted with AES-256-GCM before it is stored, under a
  key derived from `AUTH_SECRET` via PBKDF2.
- `/api/google/webhook` and `/api/google/cron` are exempt from the session
  cookie check in `src/proxy.ts` because neither caller has a cookie. They
  authenticate with the per-account channel token and `CRON_SECRET` instead, and
  `/api/google/cron` refuses to run at all if `CRON_SECRET` is unset.
- `google_accounts` and `google_calendars` have RLS on and no policies, so they
  are unreachable with the anon key.

### Known limitations

- One-way only. Events created in the dashboard stay in the dashboard.
- Events mirrored from Google can't be deleted or edited in the dashboard — the
  next sync would restore them. The row links out to Google instead.
- Only one Google account can be connected at a time.
- The month grid places a multi-day event on each day it spans, but does not
  draw a continuous bar across the week.
