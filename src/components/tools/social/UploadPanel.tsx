'use client'

// Drop many files → one draft per file. Each file is probed in the browser
// (thumbnail, JPEG variant, codecs), uploaded straight to Storage, then
// registered with finalizeUpload, which creates the draft. Two files run at a
// time; the rest wait their turn in the queue shown under the drop zone.

import { useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type Ref } from 'react'
import { CheckCircle2, CircleAlert, Loader2 } from 'lucide-react'
import { finalizeUpload, prepareUpload } from '@/lib/social/actions'
import { LIMITS, UPLOAD_ACCEPT } from '@/lib/social/config'
import { mimeOf, probeFile } from '@/lib/social/media-probe'
import type { SocialAccount, SocialPost } from '@/lib/social/types'
import { CARD_CLS, DropZone } from '@/components/tools/ui'
import { AccountAvatar, accountLabel } from './shared'
import { uploadMain, uploadSmall } from './upload'

type Item = {
  key: string
  name: string
  stage: 'waiting' | 'reading' | 'uploading' | 'saving' | 'done' | 'error'
  progress: number
  error?: string
}

export type UploadHandle = { add: (files: File[]) => void }

const CONCURRENCY = 2
const DEFAULTS_KEY = 'social:default-targets'
const DEFAULTS_EVENT = 'social:default-targets-changed'

// The default targets are a per-browser convenience in localStorage, read
// through useSyncExternalStore so the server render (no storage) and the first
// client render agree, and every change re-renders.
function readRaw(): string {
  try {
    return localStorage.getItem(DEFAULTS_KEY) ?? '[]'
  } catch {
    return '[]'
  }
}

function parseIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb)
  window.addEventListener(DEFAULTS_EVENT, cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener(DEFAULTS_EVENT, cb)
  }
}

export default function UploadPanel({
  accounts,
  onPost,
  ref,
}: {
  accounts: SocialAccount[]
  onPost: (post: SocialPost) => void
  ref?: Ref<UploadHandle>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const raw = useSyncExternalStore(subscribe, readRaw, () => '[]')
  const defaults = useMemo(() => parseIds(raw), [raw])
  const queue = useRef<{ key: string; file: File; sortKey: number }[]>([])
  const running = useRef(0)

  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)))

  const processOne = async (job: { key: string; file: File; sortKey: number }) => {
    const { key, file, sortKey } = job
    try {
      if (!UPLOAD_ACCEPT.split(',').includes(mimeOf(file))) throw new Error('Only JPEG, PNG, WebP, MP4 and MOV.')
      if (file.size > LIMITS.uploadMaxBytes) throw new Error('Over the 50 MB free-plan limit.')
      patch(key, { stage: 'reading' })
      const probe = await probeFile(file)
      const ticket = await prepareUpload({ mime: probe.mime, bytes: probe.bytes, wantJpeg: !!probe.jpeg })
      if (!ticket.ok) throw new Error(ticket.error.message)
      const t = ticket.data

      patch(key, { stage: 'uploading', progress: 0 })
      await uploadMain(t.main.path, t.main.token, file, probe.mime, (f) => patch(key, { progress: f }))
      await Promise.all([
        probe.thumb ? uploadSmall(t.thumb.path, t.thumb.token, probe.thumb) : null,
        probe.jpeg && t.jpeg ? uploadSmall(t.jpeg.path, t.jpeg.token, probe.jpeg) : null,
      ])

      patch(key, { stage: 'saving', progress: 1 })
      const res = await finalizeUpload({
        mediaId: t.mediaId,
        kind: probe.kind,
        mime: probe.mime,
        bytes: probe.bytes,
        jpegBytes: probe.jpeg && t.jpeg ? probe.jpeg.size : null,
        hasThumb: !!probe.thumb,
        width: probe.width ? Math.round(probe.width) : null,
        height: probe.height ? Math.round(probe.height) : null,
        durationS: probe.durationS,
        videoCodec: probe.videoCodec,
        audioCodec: probe.audioCodec,
        faststart: probe.faststart,
        fps: probe.fps,
        originalName: file.name.slice(0, 300),
        sortKey,
        targetIds: parseIds(readRaw()),
      })
      if (!res.ok) throw new Error(res.error.message)
      patch(key, { stage: 'done' })
      onPost(res.data)
    } catch (err) {
      patch(key, { stage: 'error', error: err instanceof Error ? err.message : 'Upload failed.' })
    }
  }

  const pump = () => {
    while (running.current < CONCURRENCY && queue.current.length) {
      const next = queue.current.shift()!
      running.current++
      processOne(next).finally(() => {
        running.current--
        pump()
      })
    }
  }

  const add = (files: File[]) => {
    // Keeps the drop order as the table order, whatever finishes first.
    const base = Date.now() / 1000
    const fresh = files.map((file, i) => ({ key: `${base}-${i}-${file.name}`, file, sortKey: base + i * 0.001 }))
    setItems((list) => [
      ...list.filter((i) => i.stage !== 'done'),
      ...fresh.map((f) => ({ key: f.key, name: f.file.name, stage: 'waiting' as const, progress: 0 })),
    ])
    queue.current.push(...fresh)
    pump()
  }

  useImperativeHandle(ref, () => ({ add }))

  const toggleDefault = (id: string) => {
    const next = defaults.includes(id) ? defaults.filter((d) => d !== id) : [...defaults, id]
    try {
      localStorage.setItem(DEFAULTS_KEY, JSON.stringify(next))
    } catch {
      // Private mode: the choice just isn't remembered.
    }
    window.dispatchEvent(new Event(DEFAULTS_EVENT))
  }

  const active = items.filter((i) => i.stage !== 'done' && i.stage !== 'error').length

  return (
    <div className={`${CARD_CLS} mb-4`}>
      <DropZone
        accept={UPLOAD_ACCEPT}
        multiple
        title="Drop images and videos, or"
        hint="JPEG, PNG, WebP, MP4, MOV · up to 50 MB each · one draft per file"
        inputRef={inputRef}
        onFiles={(list) => add(Array.from(list))}
      />
      <div className="border-t border-zinc-200 dark:border-white/[0.06] px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-zinc-500 dark:text-zinc-200 mr-1">New drafts go to</span>
        {accounts.map((a) => {
          const on = defaults.includes(a.id)
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleDefault(a.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border pl-0.5 pr-2.5 py-0.5 text-[13px] transition-all duration-150 ${
                on
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-white'
                  : 'border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <AccountAvatar account={a} size={20} />
              {accountLabel(a)}
            </button>
          )
        })}
        {!accounts.length && <span className="text-[13px] text-zinc-500 dark:text-zinc-200">no accounts switched on yet</span>}
      </div>
      {items.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-white/[0.06] px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
            <span>Uploads{active ? ` · ${active} in progress` : ''}</span>
            {!active && (
              <button onClick={() => setItems([])} className="normal-case tracking-normal font-medium hover:text-zinc-900 dark:hover:text-white">
                Clear
              </button>
            )}
          </div>
          {items.map((i) => (
            <div key={i.key} className="flex items-center gap-2 text-[13px]">
              {i.stage === 'done' ? (
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : i.stage === 'error' ? (
                <CircleAlert size={14} className="text-red-600 dark:text-red-400 shrink-0" />
              ) : (
                <Loader2 size={14} className="animate-spin text-zinc-500 dark:text-zinc-200 shrink-0" />
              )}
              <span className="truncate min-w-0 flex-1 text-zinc-800 dark:text-zinc-100">{i.name}</span>
              <span className={`shrink-0 tabular-nums ${i.stage === 'error' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-200'}`}>
                {i.stage === 'error'
                  ? i.error
                  : i.stage === 'uploading'
                    ? `${Math.round(i.progress * 100)}%`
                    : i.stage === 'reading'
                      ? 'Reading…'
                      : i.stage === 'saving'
                        ? 'Saving…'
                        : i.stage === 'waiting'
                          ? 'Waiting'
                          : 'Draft added'}
              </span>
              {i.stage === 'uploading' && (
                <span className="hidden sm:block w-24 h-1 rounded-full bg-zinc-200 dark:bg-white/10 overflow-hidden shrink-0">
                  <span className="block h-full bg-rose-500" style={{ width: `${Math.round(i.progress * 100)}%` }} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
