'use client'

// /tools/social: the bulk editor. Upload panel on top, then one row per post.
//
// Selection works like a file list: click a checkbox to toggle, shift-click to
// take the range, Ctrl/⌘+A for everything visible, Esc to clear, Delete to
// remove. The bulk bar sticks under the mobile top bar (top-11 md:top-0, per
// STYLING.md §4) whenever something is selected.
//
// Every server action hands back the posts it touched, so the table updates
// from what the database now says rather than from a local guess. While a post
// is going out, the list refreshes itself every 15 s.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  CalendarCheck,
  Clock,
  Images,
  Layers,
  Tags,
  Trash2,
  Undo2,
  Users,
  Wand2,
  X,
} from 'lucide-react'
import {
  applyCaption,
  applyTargets,
  autoFillSlots,
  combineCarousel,
  deletePosts,
  getPosts,
  retryJob,
  schedulePosts,
  setTimes,
  splitCarousel,
  unschedulePosts,
  updatePost,
  type BulkResult,
  type SocialOverview,
} from '@/lib/social/actions'
import type { ActionResult, SocialPost } from '@/lib/social/types'
import { toolByKey } from '@/lib/tools/registry'
import { EmptyState, btnPrimary, btnSecondary } from '@/components/tools/ui'
import { SetupNotices } from './AccountsPanel'
import { CaptionModal, FillModal, TargetsModal, TimeModal } from './BulkModals'
import PostRow, { type RowPatch } from './PostRow'
import { SocialHeader } from './shared'
import UploadPanel, { type UploadHandle } from './UploadPanel'

const TOOL = toolByKey('social')!

type Filter = 'all' | 'draft' | 'scheduled' | 'failed' | 'published'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'failed', label: 'Failed' },
  { value: 'published', label: 'Published' },
]
type Modal = null | 'caption' | 'targets' | 'time' | 'fill'

function matches(p: SocialPost, f: Filter): boolean {
  switch (f) {
    case 'all':
      return true
    case 'draft':
      return p.status === 'draft'
    case 'scheduled':
      return p.status === 'scheduled' || p.status === 'publishing'
    case 'failed':
      return p.status === 'failed' || p.status === 'partial'
    case 'published':
      return p.status === 'published'
  }
}

// Thumbnails are signed URLs, and every fetch signs them afresh. A new URL is a
// browser-cache miss, so the 15 s refresh would re-download every thumbnail —
// real egress on the free plan. Each media keeps the first URL it was seen with
// for 45 minutes (they are signed for 60).
const THUMB_TTL_MS = 45 * 60_000
const thumbCache = new Map<string, { url: string; at: number }>()

function stableThumbs(list: SocialPost[]): SocialPost[] {
  const now = Date.now()
  return list.map((p) => ({
    ...p,
    media: p.media.map((m) => {
      if (!m.thumb_url) return m
      const hit = thumbCache.get(m.id)
      if (hit && now - hit.at < THUMB_TTL_MS) return { ...m, thumb_url: hit.url }
      thumbCache.set(m.id, { url: m.thumb_url, at: now })
      return m
    }),
  }))
}

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

export default function BulkEditor({ overview, initialPosts }: { overview: SocialOverview; initialPosts: SocialPost[] }) {
  // Client only: the cache is per browser tab, and on the server it would leak
  // one request's URLs into the next and break hydration.
  const [posts, setPosts] = useState(() => (typeof window === 'undefined' ? initialPosts : stableThumbs(initialPosts)))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<'upload' | 'time'>('upload')
  const [modal, setModal] = useState<Modal>(null)
  const [problems, setProblems] = useState<Map<string, string>>(new Map())
  const [message, setMessage] = useState<{ text: string; err?: boolean } | null>(null)
  const [working, setWorking] = useState(false)
  const uploader = useRef<UploadHandle>(null)

  const enabled = useMemo(() => overview.accounts.filter((a) => a.enabled), [overview.accounts])
  const accountsById = useMemo(() => new Map(overview.accounts.map((a) => [a.id, a])), [overview.accounts])

  const visible = useMemo(() => {
    const list = posts.filter((p) => matches(p, filter))
    if (sort === 'time') {
      return [...list].sort((a, b) => {
        if (!a.scheduled_at) return b.scheduled_at ? 1 : a.sort_key - b.sort_key
        if (!b.scheduled_at) return -1
        return a.scheduled_at.localeCompare(b.scheduled_at)
      })
    }
    return list
  }, [posts, filter, sort])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: posts.length, draft: 0, scheduled: 0, failed: 0, published: 0 }
    for (const p of posts) for (const f of ['draft', 'scheduled', 'failed', 'published'] as const) if (matches(p, f)) c[f]++
    return c
  }, [posts])

  /** Selected ids in on-screen order — the order bulk actions work through. */
  const selectedIds = useMemo(() => visible.filter((p) => selected.has(p.id)).map((p) => p.id), [visible, selected])

  const upsert = useCallback((incoming: SocialPost[]) => {
    const updated = stableThumbs(incoming)
    setPosts((list) => {
      const byId = new Map(updated.map((p) => [p.id, p]))
      const next = list.map((p) => byId.get(p.id) ?? p)
      for (const p of updated) if (!list.some((x) => x.id === p.id)) next.push(p)
      return next.sort((a, b) => a.sort_key - b.sort_key)
    })
  }, [])

  const remove = useCallback((ids: string[]) => {
    const gone = new Set(ids)
    setPosts((list) => list.filter((p) => !gone.has(p.id)))
    setSelected((s) => new Set([...s].filter((id) => !gone.has(id))))
  }, [])

  const setProblem = useCallback((id: string, text: string | null) => {
    setProblems((m) => {
      const next = new Map(m)
      if (text) next.set(id, text)
      else next.delete(id)
      return next
    })
  }, [])

  /** Applies a bulk result: new rows, per-post problems, one summary line. */
  const applyBulk = useCallback(
    (res: ActionResult<BulkResult>, verb: string) => {
      if (!res.ok) {
        setMessage({ text: res.error.message, err: true })
        return
      }
      upsert(res.data.posts)
      setProblems((m) => {
        const next = new Map(m)
        for (const p of res.data.posts) next.delete(p.id)
        for (const pr of res.data.problems) next.set(pr.id, pr.message)
        return next
      })
      const failed = res.data.problems.length
      const done = res.data.posts.length - failed
      setMessage({
        text: failed ? `${verb} ${done} post(s); ${failed} need attention — see the red notes.` : `${verb} ${done} post(s).`,
        err: failed > 0,
      })
    },
    [upsert]
  )

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setWorking(true)
    try {
      return await fn()
    } finally {
      setWorking(false)
    }
  }, [])

  // ─── Row callbacks ─────────────────────────────────────────────────────

  const onSelect = useCallback(
    (id: string, shift: boolean) => {
      setSelected((s) => {
        const next = new Set(s)
        if (shift && anchor) {
          const ids = visible.map((p) => p.id)
          const [a, b] = [ids.indexOf(anchor), ids.indexOf(id)].sort((x, y) => x - y)
          if (a >= 0 && b >= 0) for (const x of ids.slice(a, b + 1)) next.add(x)
        } else if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      setAnchor(id)
    },
    [anchor, visible]
  )

  const onSave = useCallback(
    async (id: string, patch: RowPatch): Promise<boolean> => {
      const res = await updatePost({ id, ...patch })
      if (!res.ok) {
        setProblem(id, res.error.message)
        return false
      }
      setProblem(id, null)
      upsert([res.data])
      return true
    },
    [setProblem, upsert]
  )

  const onSchedule = useCallback(
    async (id: string) => applyBulk(await run(() => schedulePosts([id])), 'Scheduled'),
    [applyBulk, run]
  )
  const onUnschedule = useCallback(
    async (id: string) => applyBulk(await run(() => unschedulePosts([id])), 'Moved back to draft'),
    [applyBulk, run]
  )
  const onDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this post? Its uploaded files go too, unless another post uses them.')) return
      const res = await run(() => deletePosts([id]))
      if (!res.ok) return setMessage({ text: res.error.message, err: true })
      remove(res.data)
    },
    [remove, run]
  )
  const onRetry = useCallback(
    async (jobId: string) => {
      const res = await run(() => retryJob(jobId))
      if (!res.ok) return setMessage({ text: res.error.message, err: true })
      upsert([res.data])
      setMessage({ text: 'Queued to retry on the next publisher run.' })
    },
    [run, upsert]
  )
  const onSplit = useCallback(
    async (id: string) => {
      const res = await run(() => splitCarousel(id))
      if (!res.ok) return setMessage({ text: res.error.message, err: true })
      remove([res.data.removed])
      upsert(res.data.posts)
    },
    [remove, run, upsert]
  )

  // ─── Bulk actions ──────────────────────────────────────────────────────

  const bulkDelete = useCallback(async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} post(s)? Their uploaded files go too, unless another post uses them.`)) return
    const res = await run(() => deletePosts(selectedIds))
    if (!res.ok) return setMessage({ text: res.error.message, err: true })
    remove(res.data)
    setMessage({ text: `Deleted ${res.data.length} post(s).` })
  }, [remove, run, selectedIds])

  const combine = async () => {
    const res = await run(() => combineCarousel(selectedIds))
    if (!res.ok) return setMessage({ text: res.error.message, err: true })
    remove(res.data.removed)
    upsert([res.data.post])
    setSelected(new Set([res.data.post.id]))
    setMessage({ text: `Combined into one ${res.data.post.media.length}-item carousel.` })
  }

  // ─── Keyboard + page-wide drop ─────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modal || isTyping(e.target)) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelected(new Set(visible.map((p) => p.id)))
      } else if (e.key === 'Escape') {
        setSelected(new Set())
      } else if (e.key === 'Delete' && selectedIds.length) {
        e.preventDefault()
        bulkDelete()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, visible, selectedIds, bulkDelete])

  // Refresh while something is on its way out, so statuses move by themselves.
  const live = posts.some((p) => p.status === 'publishing' || p.status === 'scheduled')
  useEffect(() => {
    if (!live) return
    const timer = setInterval(async () => {
      if (document.hidden) return
      setPosts(stableThumbs(await getPosts()))
    }, 15_000)
    return () => clearInterval(timer)
  }, [live])

  const count = selectedIds.length
  const barBtn = `${btnSecondary(true)} px-2.5 py-1.5 text-[13px]`

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault()
      }}
      onDrop={(e) => {
        // The drop zone handles its own drops (and marks them handled).
        if (e.defaultPrevented || !e.dataTransfer.files.length) return
        e.preventDefault()
        uploader.current?.add(Array.from(e.dataTransfer.files))
      }}
    >
      <SocialHeader />
      <SetupNotices overview={overview} />

      <UploadPanel ref={uploader} accounts={enabled} onPost={(p) => upsert([p])} />

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        {/* Not <Segmented>: its equal-width pills wrap a label plus a count. */}
        <div className="max-w-full overflow-x-auto">
          <div className="panel inline-flex gap-1 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all duration-150 ${
                  filter === f.value
                    ? 'bg-rose-500/15 text-rose-700 dark:text-rose-100 border-rose-500/30'
                    : 'border-transparent text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
                }`}
              >
                {f.label} <span className="tabular-nums">{counts[f.value]}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setSort((s) => (s === 'upload' ? 'time' : 'upload'))}
          className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}
        >
          <ArrowDownUp size={13} /> {sort === 'upload' ? 'Upload order' : 'By time'}
        </button>
      </div>

      {count > 0 && (
        <div className="sticky top-11 md:top-0 z-20 mb-3 rounded-2xl border border-rose-500/30 bg-white/90 dark:bg-[rgba(24,10,16,0.85)] backdrop-blur-xl px-3 py-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium text-zinc-900 dark:text-white mr-1">{count} selected</span>
          <button className={barBtn} disabled={working} onClick={() => setModal('caption')}>
            <Tags size={13} /> Caption
          </button>
          <button className={barBtn} disabled={working} onClick={() => setModal('targets')}>
            <Users size={13} /> Targets
          </button>
          <button className={barBtn} disabled={working} onClick={() => setModal('time')}>
            <Clock size={13} /> Times
          </button>
          <button className={barBtn} disabled={working} onClick={() => setModal('fill')}>
            <Wand2 size={13} /> Auto-fill
          </button>
          {count >= 2 && count <= 10 && (
            <button className={barBtn} disabled={working} onClick={combine}>
              <Layers size={13} /> Carousel
            </button>
          )}
          <button
            className={`${btnPrimary(TOOL.accent, true)} px-2.5 py-1.5 text-[13px]`}
            disabled={working}
            onClick={async () => applyBulk(await run(() => schedulePosts(selectedIds)), 'Scheduled')}
          >
            <CalendarCheck size={13} /> Schedule
          </button>
          <button
            className={barBtn}
            disabled={working}
            onClick={async () => applyBulk(await run(() => unschedulePosts(selectedIds)), 'Moved back to draft')}
          >
            <Undo2 size={13} /> Unschedule
          </button>
          <button className={`${barBtn} hover:text-red-600 dark:hover:text-red-400`} disabled={working} onClick={bulkDelete}>
            <Trash2 size={13} /> Delete
          </button>
          <button onClick={() => setSelected(new Set())} aria-label="Clear selection" className="ml-auto p-1.5 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white">
            <X size={15} />
          </button>
        </div>
      )}

      {message && (
        <p className={`mb-3 text-[13px] ${message.err ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {message.text}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="panel rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02]">
          <EmptyState
            icon={Images}
            title={posts.length ? 'Nothing in this view.' : 'No posts yet.'}
            hint={posts.length ? undefined : 'Drop a batch of images or videos above — each one becomes a draft.'}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="hidden md:flex items-center gap-2 px-3 text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
            <input
              type="checkbox"
              aria-label="Select all"
              checked={visible.length > 0 && visible.every((p) => selected.has(p.id))}
              onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((p) => p.id)) : new Set())}
              className="w-4 h-4 accent-rose-500"
            />
            <span className="normal-case tracking-normal font-normal">
              Shift-click for a range · Ctrl+A all · Alt+↑↓ moves between rows · times are Budapest
            </span>
          </div>
          {visible.map((p, i) => (
            <PostRow
              key={p.id}
              post={p}
              index={i}
              accounts={enabled}
              accountsById={accountsById}
              selected={selected.has(p.id)}
              problem={problems.get(p.id) ?? null}
              onSelect={onSelect}
              onSave={onSave}
              onSchedule={onSchedule}
              onUnschedule={onUnschedule}
              onDelete={onDelete}
              onRetry={onRetry}
              onSplit={onSplit}
            />
          ))}
        </div>
      )}

      {modal === 'caption' && (
        <CaptionModal
          count={count}
          onClose={() => setModal(null)}
          onApply={async (text, mode) => {
            setModal(null)
            applyBulk(await run(() => applyCaption({ ids: selectedIds, text, mode })), 'Updated')
          }}
        />
      )}
      {modal === 'targets' && (
        <TargetsModal
          count={count}
          accounts={enabled}
          onClose={() => setModal(null)}
          onApply={async (accountIds, mode) => {
            setModal(null)
            applyBulk(await run(() => applyTargets({ ids: selectedIds, accountIds, mode })), 'Updated')
          }}
        />
      )}
      {modal === 'time' && (
        <TimeModal
          count={count}
          onClose={() => setModal(null)}
          onApply={async (startIso, stepMinutes) => {
            setModal(null)
            const start = new Date(startIso).getTime()
            const items = selectedIds.map((id, i) => ({
              id,
              scheduled_at: new Date(start + i * stepMinutes * 60_000).toISOString(),
            }))
            applyBulk(await run(() => setTimes(items)), 'Timed')
          }}
        />
      )}
      {modal === 'fill' && (
        <FillModal
          count={count}
          accounts={enabled}
          slots={overview.slots}
          onClose={() => setModal(null)}
          onApply={async (schedule) => {
            setModal(null)
            applyBulk(await run(() => autoFillSlots({ ids: selectedIds, schedule })), 'Filled')
          }}
        />
      )}
    </div>
  )
}
