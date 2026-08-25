'use client'

// The Files card, shared by the lead page, the client-project page and the MRR
// client modal. One component for all three because the thing it shows is the
// same thing in each — a list of small files hanging off one record.
//
// It loads its own list from /api/files (see that route for why) and writes
// through the server actions, which re-check the account: `canManage` here only
// decides what renders.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Paperclip, Trash2, Upload } from 'lucide-react'
import { fmtBytes } from '@/lib/tools/download'
import { deleteAttachmentAction, uploadAttachmentAction } from '@/lib/attachment-actions'
import {
  ACCEPT_ATTR,
  ALLOWED_LABEL,
  MAX_ATTACHMENT_BYTES,
  mimeForFilename,
  type Attachment,
  type AttachmentOwner,
} from '@/lib/attachment-types'

const MAX_KB = MAX_ATTACHMENT_BYTES / 1024

/**
 * Wording, because this card lands on pages in two languages: the CRM and MRR
 * are ours and English, while the client-projects board is the one screen the
 * co-worker account opens and is Hungarian throughout.
 *
 * Server-side refusals still come back in English. They are the same messages
 * the rest of the CRM returns, and inventing a second translated error path for
 * a case only an admin can trigger would be more surface than it is worth.
 */
export type AttachmentsCopy = {
  title: string
  attach: string
  working: string
  empty: string
  loadFailed: string
  deleteTitle: string
  confirmDelete: (filename: string) => string
  deleteLabel: (filename: string) => string
  hint: string
  notAllowed: (filename: string) => string
  tooLarge: (filename: string, size: string) => string
}

export const ATTACHMENTS_COPY_EN: AttachmentsCopy = {
  title: 'Files',
  attach: 'Attach a file',
  working: 'Working…',
  empty: 'Nothing attached yet.',
  loadFailed: 'Could not load the files.',
  deleteTitle: 'Delete file',
  confirmDelete: (f) => `Delete "${f}"? This can't be undone.`,
  deleteLabel: (f) => `Delete ${f}`,
  hint: `${ALLOWED_LABEL} · up to ${MAX_KB} KB each`,
  notAllowed: (f) => `${f} is not a type you can attach. Allowed: ${ALLOWED_LABEL}.`,
  tooLarge: (f, size) => `${f} is ${size} — the limit is ${MAX_KB} KB.`,
}

export const ATTACHMENTS_COPY_HU: AttachmentsCopy = {
  title: 'Fájlok',
  attach: 'Fájl csatolása',
  working: 'Feltöltés…',
  empty: 'Még nincs csatolt fájl.',
  loadFailed: 'A fájlokat nem sikerült betölteni.',
  deleteTitle: 'Fájl törlése',
  confirmDelete: (f) => `Törlöd ezt: „${f}”? Ez nem vonható vissza.`,
  deleteLabel: (f) => `${f} törlése`,
  hint: `${ALLOWED_LABEL} · legfeljebb ${MAX_KB} KB`,
  notAllowed: (f) => `${f} nem csatolható típus. Engedélyezett: ${ALLOWED_LABEL}.`,
  tooLarge: (f, size) => `${f} mérete ${size} — a határ ${MAX_KB} KB.`,
}

/**
 * Reads the list. Kept free of state so the effect below only has to attach a
 * continuation — no setState runs synchronously when it mounts. Same shape as
 * listBackgrounds in BackgroundControls, which solved this first.
 */
async function fetchAttachments(
  kind: AttachmentOwner['kind'],
  id: string
): Promise<{ files: Attachment[]; failed: boolean }> {
  try {
    const res = await fetch(`/api/files?ownerKind=${kind}&ownerId=${id}`)
    if (!res.ok) return { files: [], failed: true }
    return { files: (await res.json()) as Attachment[], failed: false }
  } catch {
    return { files: [], failed: true }
  }
}

/** Short date for the sub-line. Client-side only, so no hydration mismatch. */
function shortDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function AttachmentsCard({
  owner,
  canManage,
  nested = false,
  copy = ATTACHMENTS_COPY_EN,
}: {
  owner: AttachmentOwner
  /** Admin-only. The actions check the session again for themselves. */
  canManage: boolean
  /**
   * Inside a modal or another panelled surface. Per STYLING.md the frosted
   * `.panel` layer belongs on the outermost card only — nesting one just dims
   * the wallpaper twice.
   */
  nested?: boolean
  copy?: AttachmentsCopy
}) {
  const router = useRouter()
  const [files, setFiles] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Returns void and is handed to useEffect by reference, not called inside an
  // arrow body — the setState only ever runs in the continuation.
  const refresh = useCallback(() => {
    fetchAttachments(owner.kind, owner.id).then(({ files, failed }) => {
      setLoading(false)
      // Don't wipe an upload or delete message this refresh was not about.
      if (failed) setError(copy.loadFailed)
      else setFiles(files)
    })
  }, [owner.kind, owner.id, copy])

  useEffect(refresh, [refresh])

  async function upload(picked: FileList | File[] | null) {
    if (!picked?.length || !canManage) return
    setError('')
    setBusy(true)

    for (const file of Array.from(picked)) {
      // Checked again in the action — this only spares the round-trip and
      // names the offending file straight away.
      if (!mimeForFilename(file.name)) {
        setError(copy.notAllowed(file.name))
        continue
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(copy.tooLarge(file.name, fmtBytes(file.size)))
        continue
      }

      const body = new FormData()
      body.set('ownerKind', owner.kind)
      body.set('ownerId', owner.id)
      body.set('file', file)

      const result = await uploadAttachmentAction(body)
      if (!result.ok) setError(result.error.message)
    }

    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
    refresh()
    // A lead records the attachment on its timeline, so the page behind this
    // card has changed too.
    startTransition(() => router.refresh())
  }

  function remove(file: Attachment) {
    if (!canManage) return
    if (!confirm(copy.confirmDelete(file.filename))) return
    setError('')
    setBusy(true)
    startTransition(async () => {
      const result = await deleteAttachmentAction(owner.kind, owner.id, file.id)
      setBusy(false)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
      // A lead records the removal on its timeline, same as the attachment.
      router.refresh()
    })
  }

  const card = nested
    ? 'rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] p-4'
    : 'panel bg-white/60 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06] rounded-xl p-4'

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm text-zinc-800 dark:text-white">{copy.title}</h2>
        {files.length > 0 && (
          <span className="text-[12px] text-zinc-500 dark:text-zinc-200 tabular-nums">
            {files.length}
          </span>
        )}
      </div>

      {canManage && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            multiple
            hidden
            onChange={(e) => upload(e.target.files)}
          />
          <button
            // Explicit, because this card is rendered next to forms and a bare
            // button inside one defaults to submitting it.
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              upload(e.dataTransfer.files)
            }}
            disabled={busy}
            className={`w-full flex items-center justify-center gap-2 py-3 mb-3 rounded-xl border border-dashed text-[13px] font-medium transition-all disabled:opacity-50 ${
              dragging
                ? 'border-indigo-500/50 bg-indigo-500/[0.08] text-indigo-600 dark:text-indigo-300'
                : 'border-zinc-300 dark:border-white/[0.10] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.18]'
            }`}
          >
            {busy ? (
              <>
                <Loader2 size={13} className="animate-spin" /> {copy.working}
              </>
            ) : (
              <>
                <Upload size={13} /> {copy.attach}
              </>
            )}
          </button>
        </>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6 text-zinc-500 dark:text-zinc-200">
          <Loader2 size={15} className="animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[13px] text-zinc-500 dark:text-zinc-200">
          <Paperclip size={13} />
          {copy.empty}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="group flex items-center gap-2.5 rounded-lg border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-2.5 py-2"
            >
              <FileText size={14} className="shrink-0 text-zinc-500 dark:text-zinc-200" />
              <a
                href={`/api/files/${file.id}`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1"
              >
                <span className="block truncate text-[13px] text-zinc-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                  {file.filename}
                </span>
                <span className="block text-[12px] text-zinc-500 dark:text-zinc-200 tabular-nums">
                  {fmtBytes(file.size_bytes)} · {shortDate(file.created_at)} · {file.uploaded_by}
                </span>
              </a>
              {canManage && (
                <button
                  type="button"
                  onClick={() => remove(file)}
                  disabled={busy}
                  title={copy.deleteTitle}
                  aria-label={copy.deleteLabel(file.filename)}
                  className="shrink-0 rounded-md p-1 text-zinc-500 dark:text-zinc-200 opacity-0 group-hover:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <p className="mt-3 text-[12px] text-zinc-500 dark:text-zinc-200">{copy.hint}</p>
      )}
    </section>
  )
}
