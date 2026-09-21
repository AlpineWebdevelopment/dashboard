'use client'

// Small pieces every Social Scheduler screen uses: the sub-page tabs, platform
// glyphs, account avatars, thumbnails and status pills.
//
// Styling per STYLING.md: 13px floor (12px for pills), dark:text-zinc-200 for
// resting secondary text, `.panel` only on standalone surfaces.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Film, Images } from 'lucide-react'
import { formatTime } from '@/lib/social/time'
import { toolByKey } from '@/lib/tools/registry'
import { ToolHeader } from '@/components/tools/ui'
import type { JobStatus, Platform, PostStatus, SocialAccount, SocialJob } from '@/lib/social/types'

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

const TABS = [
  { href: '/tools/social', label: 'Posts' },
  { href: '/tools/social/calendar', label: 'Calendar' },
  { href: '/tools/social/accounts', label: 'Accounts' },
]

export function SocialNav() {
  const pathname = usePathname()
  return (
    <nav className="panel inline-flex gap-1 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] p-1">
      {TABS.map((t) => {
        const on = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
              on
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-100 border-rose-500/30'
                : 'border-transparent text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * The tool header with the tabs at its right on md+, and under it on a phone —
 * beside the title at 390px the tab strip squeezed the heading into a column
 * one word wide.
 */
export function SocialHeader() {
  return (
    <>
      <ToolHeader
        tool={toolByKey('social')!}
        actions={
          <div className="hidden md:block">
            <SocialNav />
          </div>
        }
      />
      <div className="md:hidden -mt-2 mb-4">
        <SocialNav />
      </div>
    </>
  )
}

/* ── Platform glyphs ──────────────────────────────────────────────────────── */

// lucide dropped its brand icons, so these are drawn here: a plain "f" disc and
// the camera outline, in the platforms' own colours.
export function PlatformGlyph({ platform, size = 14 }: { platform: Platform; size?: number }) {
  if (platform === 'facebook') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Facebook" role="img" className="shrink-0">
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path
          d="M13.4 19.5v-6.1h2.1l.3-2.4h-2.4V9.5c0-.7.2-1.2 1.2-1.2h1.3V6.2c-.2 0-1-.1-1.9-.1-1.9 0-3.1 1.1-3.1 3.2V11H8.8v2.4h2.1v6.1h2.5z"
          fill="#fff"
        />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Instagram" role="img" className="shrink-0">
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F58529" />
          <stop offset="0.5" stopColor="#DD2A7B" />
          <stop offset="1" stopColor="#8134AF" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="24" rx="7" fill="url(#ig-grad)" />
      <rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="16.1" cy="7.9" r="1" fill="#fff" />
    </svg>
  )
}

/* ── Images ───────────────────────────────────────────────────────────────── */

/**
 * The one raw <img> in the tool. Thumbnails are short-lived signed Storage
 * URLs and avatars come off Meta's CDN; next/image would need both hosts in
 * remotePatterns and would cache URLs that expire within the hour.
 */
export function RemoteImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" draggable={false} />
}

export function accountLabel(a: Pick<SocialAccount, 'name' | 'username' | 'platform'>): string {
  if (a.platform === 'instagram' && a.username) return `@${a.username}`
  return a.name ?? (a.platform === 'instagram' ? 'Instagram' : 'Page')
}

export function AccountAvatar({ account, size = 28 }: { account: SocialAccount; size?: number }) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {account.picture_url ? (
        <RemoteImg
          src={account.picture_url}
          alt=""
          className="w-full h-full rounded-full object-cover border border-zinc-200 dark:border-white/10"
        />
      ) : (
        <span className="grid place-items-center w-full h-full rounded-full bg-zinc-200 dark:bg-white/10 text-[12px] font-semibold text-zinc-600 dark:text-zinc-200">
          {accountLabel(account).replace('@', '').slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="absolute -right-1 -bottom-1 rounded-full ring-2 ring-white dark:ring-zinc-950">
        <PlatformGlyph platform={account.platform} size={Math.max(12, Math.round(size * 0.45))} />
      </span>
    </span>
  )
}

export function MediaThumb({
  url,
  kind,
  count = 1,
  className = 'w-12 h-12',
}: {
  url: string | null
  kind: 'image' | 'video'
  count?: number
  className?: string
}) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-lg bg-zinc-200 dark:bg-white/[0.06] ${className}`}>
      {url && <RemoteImg src={url} alt="" className="w-full h-full object-cover" />}
      {(kind === 'video' || count > 1) && (
        <span className="absolute right-0.5 top-0.5 flex items-center gap-0.5 rounded bg-black/65 px-1 text-[12px] leading-4 text-white">
          {count > 1 ? <Images size={10} /> : <Film size={10} />}
          {count > 1 ? count : null}
        </span>
      )}
    </span>
  )
}

/* ── Status ───────────────────────────────────────────────────────────────── */

const JOB_STYLE: Record<JobStatus, string> = {
  scheduled: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200',
  creating: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  processing: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  publishing: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  published: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  failed: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200',
  cancelled: 'border-zinc-400/30 bg-zinc-500/10 text-zinc-600 dark:text-zinc-200',
}

export const JOB_LABEL: Record<JobStatus, string> = {
  scheduled: 'Scheduled',
  creating: 'Uploading',
  processing: 'Processing',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

export function jobPillCls(status: JobStatus) {
  return `inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[12px] font-medium whitespace-nowrap ${JOB_STYLE[status]}`
}

const POST_STYLE: Record<PostStatus, string> = {
  draft: 'border-zinc-300 dark:border-white/15 text-zinc-600 dark:text-zinc-200',
  scheduled: JOB_STYLE.scheduled,
  publishing: JOB_STYLE.publishing,
  published: JOB_STYLE.published,
  partial: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-200',
  failed: JOB_STYLE.failed,
}

const POST_LABEL: Record<PostStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  publishing: 'Publishing',
  published: 'Published',
  partial: 'Partly failed',
  failed: 'Failed',
}

export function PostStatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[12px] font-medium ${POST_STYLE[status]}`}>
      {POST_LABEL[status]}
    </span>
  )
}

/** What a job's pill tooltip says: the failure, or the last hiccup and when it retries. */
export function jobDetail(job: SocialJob): string | null {
  if (job.status === 'failed') return job.error_message
  if (job.error_message && job.status !== 'published') {
    return `${job.error_message}${job.error_kind ? ` · next try ${formatTime(job.run_at)}` : ''}`
  }
  return null
}
