'use client'

// One bulk-editor row: a post, its targets, time, validation and job status.
//
// Each row is its own panelled card (STYLING.md §2: `.panel` on the row, not on
// the list), laid out as a grid on md+ and stacked on a phone. Inputs keep a
// local draft and commit on blur, so typing never waits on the server; a
// refused edit snaps back and the reason shows under the row.
//
// Keyboard: Alt+↑/↓ in a caption or time field jumps to the same field in the
// row above/below; Esc in the caption abandons the edit; Ctrl+Enter commits.

import { memo, useMemo, useState } from 'react'
import { CalendarCheck, ExternalLink, RotateCcw, Split, Trash2, Undo2 } from 'lucide-react'
import { LIMITS } from '@/lib/social/config'
import { formatWhen, fromLocalInput, toLocalInput } from '@/lib/social/time'
import type { JobStatus, Platform, SocialAccount, SocialPost } from '@/lib/social/types'
import { countHashtags, validatePost } from '@/lib/social/validate'
import {
  AccountAvatar,
  JOB_LABEL,
  MediaThumb,
  PlatformGlyph,
  PostStatusBadge,
  accountLabel,
  jobDetail,
  jobPillCls,
} from './shared'

const IN_FLIGHT: JobStatus[] = ['creating', 'processing', 'publishing']
const TYPE_LABEL = { image: 'Image', reel: 'Reel', carousel: 'Carousel' } as const

export type RowPatch = { caption?: string; scheduled_at?: string | null; target_ids?: string[] }

type Props = {
  post: SocialPost
  index: number
  accounts: SocialAccount[]
  accountsById: Map<string, SocialAccount>
  selected: boolean
  problem: string | null
  onSelect: (id: string, shift: boolean) => void
  onSave: (id: string, patch: RowPatch) => Promise<boolean>
  onSchedule: (id: string) => void
  onUnschedule: (id: string) => void
  onDelete: (id: string) => void
  onRetry: (jobId: string) => void
  onSplit: (id: string) => void
}

function focusSibling(index: number, col: string, delta: number) {
  const el = document.querySelector<HTMLElement>(`[data-row="${index + delta}"][data-col="${col}"]`)
  el?.focus()
}

function PostRow({
  post,
  index,
  accounts,
  accountsById,
  selected,
  problem,
  onSelect,
  onSave,
  onSchedule,
  onUnschedule,
  onDelete,
  onRetry,
  onSplit,
}: Props) {
  // Local drafts, re-seeded whenever the server copy changes (React's
  // "adjust state while rendering" pattern, not an effect).
  const [caption, setCaption] = useState(post.caption)
  const [seenCaption, setSeenCaption] = useState(post.caption)
  if (post.caption !== seenCaption) {
    setSeenCaption(post.caption)
    setCaption(post.caption)
  }
  const serverTime = toLocalInput(post.scheduled_at)
  const [time, setTime] = useState(serverTime)
  const [seenTime, setSeenTime] = useState(serverTime)
  if (serverTime !== seenTime) {
    setSeenTime(serverTime)
    setTime(serverTime)
  }
  const [showIssues, setShowIssues] = useState(false)

  const inFlight = post.jobs.some((j) => IN_FLIGHT.includes(j.status))
  const locked = inFlight || post.status === 'published'
  const platforms = post.target_ids.map((id) => accountsById.get(id)?.platform).filter(Boolean) as Platform[]
  const issues = useMemo(
    () => validatePost({ caption, media: post.media, platforms }),
    // platforms is derived from target_ids; list the source, not the array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caption, post.media, post.target_ids, accountsById]
  )
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')
  const igTargeted = platforms.includes('instagram')
  const tags = countHashtags(caption)

  const commitCaption = async () => {
    if (caption === post.caption) return
    const ok = await onSave(post.id, { caption })
    if (!ok) setCaption(post.caption)
  }
  const commitTime = async () => {
    if (time === serverTime) return
    const iso = time ? fromLocalInput(time) : null
    const ok = await onSave(post.id, { scheduled_at: iso })
    if (!ok) setTime(serverTime)
  }
  const toggleTarget = (accountId: string) => {
    const next = post.target_ids.includes(accountId)
      ? post.target_ids.filter((t) => t !== accountId)
      : [...post.target_ids, accountId]
    onSave(post.id, { target_ids: next })
  }

  const first = post.media[0]
  const canSchedule = post.status === 'draft' || post.status === 'failed' || post.status === 'partial'
  const canUnschedule = post.status === 'scheduled' || (post.status === 'failed' && post.jobs.some((j) => j.status === 'failed'))

  return (
    <div
      className={`panel rounded-2xl border p-3 transition-colors ${
        selected
          ? 'border-rose-500/50 bg-rose-50/60 dark:bg-rose-500/[0.07]'
          : 'border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02]'
      }`}
    >
      <div className="grid gap-3 grid-cols-[auto_auto_1fr] md:grid-cols-[auto_auto_minmax(0,1fr)_auto_190px_230px] items-start">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => {}}
          onClick={(e) => onSelect(post.id, e.shiftKey)}
          aria-label={`Select post ${index + 1}`}
          data-row={index}
          data-col="select"
          className="mt-1 w-4 h-4 accent-rose-500"
        />

        <div className="flex flex-col items-center gap-1 w-14">
          <MediaThumb url={first?.thumb_url ?? null} kind={first?.kind ?? 'image'} count={post.media.length} className="w-14 h-14" />
          <span className="text-[12px] text-zinc-500 dark:text-zinc-200">{TYPE_LABEL[post.post_type]}</span>
        </div>

        {/* Caption */}
        <div className="min-w-0 col-span-1">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={commitCaption}
            onKeyDown={(e) => {
              if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault()
                focusSibling(index, 'caption', e.key === 'ArrowUp' ? -1 : 1)
              } else if (e.key === 'Escape') {
                setCaption(post.caption)
                e.currentTarget.blur()
              } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.currentTarget.blur()
              }
            }}
            disabled={locked}
            rows={3}
            placeholder="Caption…"
            data-row={index}
            data-col="caption"
            className="w-full resize-y min-h-[64px] rounded-lg border border-zinc-200 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.03] px-2.5 py-1.5 text-[13px] leading-relaxed text-zinc-800 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 outline-none focus:border-rose-500/50 disabled:opacity-60"
          />
          <div className="mt-0.5 flex gap-2 text-[12px] tabular-nums text-zinc-500 dark:text-zinc-200">
            <span className={igTargeted && caption.length > LIMITS.caption.igMaxChars ? 'text-red-600 dark:text-red-400' : ''}>
              {caption.length}
              {igTargeted ? ` / ${LIMITS.caption.igMaxChars}` : ''}
            </span>
            <span className={igTargeted && tags > LIMITS.caption.igMaxHashtags ? 'text-red-600 dark:text-red-400' : ''}>
              {tags} #
            </span>
          </div>
        </div>

        {/* Targets */}
        <div className="col-span-3 md:col-span-1 flex flex-wrap gap-1.5 md:max-w-[180px]" role="group" aria-label="Targets">
          {accounts.length === 0 && <span className="text-[13px] text-zinc-500 dark:text-zinc-200">No accounts on</span>}
          {accounts.map((a) => {
            const on = post.target_ids.includes(a.id)
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                title={`${accountLabel(a)} (${a.platform === 'facebook' ? 'Facebook' : 'Instagram'})`}
                disabled={locked}
                onClick={() => toggleTarget(a.id)}
                className={`rounded-full p-0.5 border-2 transition-all duration-150 disabled:pointer-events-none ${
                  on ? 'border-rose-500' : 'border-transparent opacity-40 grayscale hover:opacity-80'
                }`}
              >
                <AccountAvatar account={a} size={24} />
              </button>
            )
          })}
        </div>

        {/* Time */}
        <div className="col-span-3 md:col-span-1">
          <input
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={commitTime}
            onKeyDown={(e) => {
              if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault()
                focusSibling(index, 'time', e.key === 'ArrowUp' ? -1 : 1)
              } else if (e.key === 'Enter') e.currentTarget.blur()
            }}
            disabled={locked}
            data-row={index}
            data-col="time"
            aria-label="Scheduled time (Budapest)"
            className="w-full rounded-lg border border-zinc-200 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-800 dark:text-zinc-100 outline-none focus:border-rose-500/50 disabled:opacity-60 [color-scheme:light] dark:[color-scheme:dark]"
          />
          <div className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-200">
            {post.scheduled_at ? formatWhen(post.scheduled_at) : 'No time yet'}
          </div>
        </div>

        {/* Status + actions */}
        <div className="col-span-3 md:col-span-1 flex flex-col gap-1.5 items-start">
          <div className="flex items-center gap-1.5 flex-wrap">
            <PostStatusBadge status={post.status} />
            <div className="flex items-center gap-0.5">
              {canSchedule && (
                <button
                  type="button"
                  onClick={() => onSchedule(post.id)}
                  title="Schedule"
                  className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                >
                  <CalendarCheck size={15} />
                </button>
              )}
              {canUnschedule && (
                <button
                  type="button"
                  onClick={() => onUnschedule(post.id)}
                  title="Back to draft"
                  className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                >
                  <Undo2 size={15} />
                </button>
              )}
              {post.post_type === 'carousel' && post.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => onSplit(post.id)}
                  title="Split into single posts"
                  className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                >
                  <Split size={15} />
                </button>
              )}
              {!inFlight && (
                <button
                  type="button"
                  onClick={() => onDelete(post.id)}
                  title="Delete"
                  className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
          {post.jobs.length > 0 && (
            <div className="flex flex-col gap-1">
              {post.jobs.map((j) => {
                const a = accountsById.get(j.account_id)
                const detail = jobDetail(j)
                return (
                  <div key={j.id} className="flex items-center gap-1.5 flex-wrap">
                    <span className={jobPillCls(j.status)} title={detail ?? undefined}>
                      {a && <PlatformGlyph platform={a.platform} size={11} />}
                      {a ? accountLabel(a) : 'Removed account'} · {JOB_LABEL[j.status]}
                    </span>
                    {j.permalink && (
                      <a
                        href={j.permalink}
                        target="_blank"
                        rel="noreferrer"
                        title="Open the live post"
                        className="text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {j.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => onRetry(j.id)}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-rose-700 dark:text-rose-200 hover:underline"
                      >
                        <RotateCcw size={12} /> Retry
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {(problem || errors.length > 0 || warnings.length > 0 || post.jobs.some((j) => j.status === 'failed')) && (
        <div className="mt-2 pl-7 space-y-0.5">
          {problem && <p className="text-[13px] text-red-600 dark:text-red-400">{problem}</p>}
          {post.jobs
            .filter((j) => j.status === 'failed' && j.error_message)
            .map((j) => (
              <p key={j.id} className="text-[13px] text-red-600 dark:text-red-400">
                {accountsById.get(j.account_id) ? `${accountLabel(accountsById.get(j.account_id)!)}: ` : ''}
                {j.error_message}
              </p>
            ))}
          {(showIssues ? [...errors, ...warnings] : [...errors, ...warnings].slice(0, 1)).map((i, k) => (
            <p
              key={k}
              className={`flex items-start gap-1.5 text-[13px] ${i.level === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-700 dark:text-amber-300'}`}
            >
              {i.platform && <PlatformGlyph platform={i.platform} size={12} />}
              <span>{i.message}</span>
            </p>
          ))}
          {errors.length + warnings.length > 1 && (
            <button
              type="button"
              onClick={() => setShowIssues((v) => !v)}
              className="text-[12px] text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white"
            >
              {showIssues ? 'Show less' : `+${errors.length + warnings.length - 1} more`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(PostRow)
