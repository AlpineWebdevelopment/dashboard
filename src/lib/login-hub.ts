// The Login Hub: one click to the right account, instead of the account
// switcher dance.
//
// This is a list of LINKS ONLY — no passwords, no tokens, nothing secret. It is
// committed to the repo like any other source file, so never put a credential
// in here. Signing in still happens on the provider's own page.
//
// Multi-account URLs, for reference when filling this in:
//   Google  — every Google property takes a /u/<n> segment, numbered in the
//             order you signed the accounts into the browser. /u/0 is the first.
//             mail.google.com/mail/u/1/, calendar.google.com/calendar/u/1/r
//   Supabase— supabase.com/dashboard/project/<project-ref>, or
//             supabase.com/dashboard/org/<org-slug> for the org's project list.

export type Account = {
  id: string
  /** Which account this is — "Personal", "work@…", the project name. */
  label: string
  url: string
  /** Optional second line: the email, org, or anything disambiguating. */
  hint?: string
}

export type Service = {
  id: string
  name: string
  /** Picks the logo. See BRAND_MARKS in components/BrandMark.tsx; anything
   *  unknown falls back to a lettered tile in `color`. */
  brand: string
  /** Tailwind classes for the fallback tile and the group accent. */
  color: string
  accounts: Account[]
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER DATA — replace with your real accounts.
//
// The Google entries below use the standard /u/<n> pattern and will work once
// the numbering matches your browser. The Supabase ones need your actual
// project refs, so they point at the dashboard root for now.
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICES: Service[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    brand: 'gmail',
    color: 'bg-rose-500/15 text-rose-500 dark:text-rose-400',
    accounts: [
      { id: 'gmail-0', label: 'Account 1', url: 'https://mail.google.com/mail/u/0/', hint: 'you@gmail.com' },
      { id: 'gmail-1', label: 'Account 2', url: 'https://mail.google.com/mail/u/1/', hint: 'work@…' },
      { id: 'gmail-2', label: 'Account 3', url: 'https://mail.google.com/mail/u/2/', hint: 'other@…' },
    ],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    brand: 'supabase',
    color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    accounts: [
      { id: 'sb-1', label: 'Project 1', url: 'https://supabase.com/dashboard/projects', hint: 'add project ref' },
      { id: 'sb-2', label: 'Project 2', url: 'https://supabase.com/dashboard/projects', hint: 'add project ref' },
      { id: 'sb-3', label: 'Project 3', url: 'https://supabase.com/dashboard/projects', hint: 'add project ref' },
      { id: 'sb-4', label: 'Project 4', url: 'https://supabase.com/dashboard/projects', hint: 'add project ref' },
      { id: 'sb-5', label: 'Project 5', url: 'https://supabase.com/dashboard/projects', hint: 'add project ref' },
    ],
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    brand: 'google-calendar',
    color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    accounts: [
      { id: 'cal-0', label: 'Account 1', url: 'https://calendar.google.com/calendar/u/0/r' },
      { id: 'cal-1', label: 'Account 2', url: 'https://calendar.google.com/calendar/u/1/r' },
    ],
  },
  {
    id: 'meet',
    name: 'Google Meet',
    brand: 'google-meet',
    color: 'bg-green-500/15 text-green-600 dark:text-green-400',
    accounts: [
      { id: 'meet-0', label: 'Account 1', url: 'https://meet.google.com/?authuser=0' },
      { id: 'meet-1', label: 'Account 2', url: 'https://meet.google.com/?authuser=1' },
    ],
  },
  {
    id: 'drive',
    name: 'Google Drive',
    brand: 'google-drive',
    color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    accounts: [
      { id: 'drive-0', label: 'Account 1', url: 'https://drive.google.com/drive/u/0/my-drive' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    brand: 'github',
    color: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-200',
    accounts: [
      { id: 'gh-0', label: 'AlpineWebdevelopment', url: 'https://github.com/AlpineWebdevelopment' },
    ],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    brand: 'vercel',
    color: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-200',
    accounts: [
      { id: 'vc-0', label: 'Dashboard', url: 'https://vercel.com/dashboard' },
    ],
  },
]
