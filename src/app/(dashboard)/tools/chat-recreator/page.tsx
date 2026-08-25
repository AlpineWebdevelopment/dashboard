'use client'

import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from 'react'
import {
  ArrowLeftRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  MessagesSquare,
  MoreVertical,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  Redo2,
  Upload,
  X,
} from 'lucide-react'
import { downloadBlob } from '@/lib/tools/download'
import { usePasteSanitizer, sanitizePastedText } from '@/lib/tools/paste-sanitizer'
import { toolByKey } from '@/lib/tools/registry'
import {
  MessageMarkdown,
  extractSources,
  expandSources,
  type Sources,
} from '@/components/tools/chat-markdown'
import {
  CARD_CLS,
  EmptyState,
  Modal,
  ToolHeader,
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '@/components/tools/ui'

const TOOL = toolByKey('chat-recreator')!
const ACCENT = TOOL.accent
const MAX_UNDO = 20

type Sender = 'ME' | 'AI' | ''
type Message = { sender: Sender; message: string; sources?: Sources }
type Segment = { name: string; startIndex: number }
// `chats.id` is a bigint in the database, so it arrives as a number. Typed
// loosely because the id is only ever round-tripped back to the API.
type TemplateId = string | number
type Template = { id: TemplateId; label: string; content: Message[] }
type Snapshot = { messages: Message[]; segments: Segment[] }

/* ═══════════════════════════════════════════════════════════════════════════
   MD ↔ OBJECT HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse our own MD format:
 *   ## AI: message line 1
 *   continued line
 *
 *   ## ME: another message
 */
function parseMd(md: string): Message[] {
  const blocks = md.split(/^(?=## (?:AI|ME): )/m)
  const messages: Message[] = []
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^## (AI|ME): ([\s\S]*)$/)
    if (!match) continue
    const sender = match[1] as Sender
    const message = match[2].trim()
    if (message) messages.push({ sender, message })
  }
  return messages
}

/** Serialize object array → our MD format. */
function toMd(messages: Message[]): string {
  return messages
    .filter((m) => !(m.sender === '' && m.message === ''))
    .map((m) => `## ${m.sender}: ${expandSources(m.message, m.sources)}`)
    .join('\n\n')
}

/**
 * Run imported messages through the same link-shortening + source-extraction
 * pipeline as pasting: real `[label](url)` links become clickable `{{src}}`
 * chips and their long URLs are lifted onto each message's `sources` map, so
 * the edit textareas stay short.
 */
function withSources(messages: Message[]): Message[] {
  return messages.map((m) => {
    const sanitized = sanitizePastedText(m.message || '')
    const { text, sources } = extractSources(sanitized, m.sources)
    return { ...m, message: text, sources }
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   MD → JSON CONVERTER (ChatGPT / Claude / Perplexity) — for "Import from MD"
   ═══════════════════════════════════════════════════════════════════════════ */

function isPerplexityMd(md: string): boolean {
  return /perplexity\.ai/i.test(md) || /\[\^\d+_\d+\]/.test(md) || md.includes('⁂')
}

function cleanPerplexityAnswer(text: string): string {
  return text
    // [\s\S] rather than the `s` flag: the build targets ES2017, where
    // dotAll is not available.
    .replace(/<span style="display:none">[\s\S]*?<\/span>/g, '')
    .replace(/<div align="center">⁂<\/div>/g, '')
    .replace(/^\[\^\d+_\d+\]:\s*.*$/gm, '')
    .replace(/\[\^\d+_\d+\]/g, '')
    .replace(/<img[^>]*perplexity[^>]*\/?>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function convertPerplexityMd(md: string): Message[] {
  const cleaned = md.replace(/<img[^>]*perplexity[^>]*\/?>\s*/gi, '')
  const blocks = cleaned.trim().split(/^(?=# )/m)
  const messages: Message[] = []

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    const h1 = trimmed.match(/^# (.+)$/m)
    if (!h1) continue

    const question = h1[1].replace(/\[\^\d+_\d+\]/g, '').trim()
    const answer = cleanPerplexityAnswer(trimmed.slice(h1[0].length).trim())

    if (question) messages.push({ sender: 'ME', message: question })
    if (answer) messages.push({ sender: 'AI', message: answer })
  }
  return messages
}

function convertChatMd(md: string): Message[] {
  const blocks = md.split(/^---$/m)
  const messages: Message[] = []
  const humanRoles = /^## (?:User|Human|Me)\b/im
  const aiRoles =
    /^## (?:Assistant|AI|Claude|ChatGPT|Perplexity|Model|GPT|Gemini|Copilot)\b/im

  for (const block of blocks) {
    const trimmed = block.trim()
    const isHuman = humanRoles.test(trimmed)
    const isAI = aiRoles.test(trimmed)
    if (!isHuman && !isAI) continue

    const sender: Sender = isHuman ? 'ME' : 'AI'
    let body = trimmed.replace(/^## \S+.*$/m, '').trim()

    if (sender === 'AI') {
      // Some exports repeat the first line of a thinking block; drop the run.
      const lines = body.split('\n')
      let start = 0
      while (start < lines.length && lines[start].trim() === '') start++
      if (start < lines.length - 1) {
        const first = lines[start].trim()
        let thinkEnd = start
        for (let i = start + 1; i < lines.length; i++) {
          if (lines[i].trim() === first) thinkEnd = i
          else break
        }
        if (thinkEnd > start) start = thinkEnd + 1
      }
      body = lines.slice(start).join('\n').trim()
    }

    if (sender === 'ME') {
      body = body
        .replace(
          /\n{1,}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,?\s*\d{4})?\s*$/i,
          ''
        )
        .trim()
    }

    if (body) messages.push({ sender, message: body })
  }
  return messages
}

function convertMdToJson(md: string): Message[] {
  if (isPerplexityMd(md)) return convertPerplexityMd(md)
  return convertChatMd(md)
}

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL CHROME
   ═══════════════════════════════════════════════════════════════════════════ */

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <Modal onClose={onClose}>
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white tracking-tight">
          {title}
        </h2>
        <button onClick={onClose} className={`${btnGhost()} -mr-2 -mt-1 p-1.5 rounded-md`}>
          <X size={14} />
        </button>
      </div>
      <div className="px-6 pb-6 pt-3">{children}</div>
    </Modal>
  )
}

/* ── Save modal ───────────────────────────────────────────────────────────── */

function SaveModal({
  isOpen,
  onClose,
  onSave,
  loadedTemplate,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (arg: { mode: 'new' | 'overwrite'; label: string; id?: TemplateId }) => void
  loadedTemplate: Template | null
}) {
  const [label, setLabel] = useState('')
  const [mode, setMode] = useState<'new' | 'overwrite' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset on open, without an effect: opening is a render, not a side effect.
  const [prevIsOpen, setPrevIsOpen] = useState(false)
  if (isOpen && !prevIsOpen) {
    if (loadedTemplate) {
      setMode(null)
      setLabel(loadedTemplate.label)
    } else {
      setMode('new')
      setLabel('')
    }
  }
  if (isOpen !== prevIsOpen) setPrevIsOpen(isOpen)

  useEffect(() => {
    if (mode && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [mode])

  if (!isOpen) return null

  function handleSubmit() {
    const trimmed = label.trim()
    if (!trimmed || !mode) return
    onSave({
      mode,
      label: trimmed,
      id: mode === 'overwrite' ? loadedTemplate?.id : undefined,
    })
  }

  if (loadedTemplate && mode === null) {
    return (
      <ModalShell title="Save template" onClose={onClose}>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mb-5 leading-relaxed">
          Loaded from{' '}
          <span className="font-medium text-zinc-800 dark:text-white">
            {loadedTemplate.label}
          </span>
          . What would you like to do?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setMode('overwrite')}
            className={`${btnPrimary(ACCENT, true)} w-full px-4 py-2.5 text-sm`}
          >
            <RotateCcw size={14} />
            Overwrite existing
          </button>
          <button
            onClick={() => {
              setMode('new')
              setLabel('')
            }}
            className={`${btnSecondary(true)} w-full px-4 py-2.5 text-sm`}
          >
            <Bookmark size={14} />
            Save as new
          </button>
        </div>
      </ModalShell>
    )
  }

  return (
    <ModalShell
      title={mode === 'overwrite' ? 'Update template' : 'Save new template'}
      onClose={onClose}
    >
      <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mb-4">
        {mode === 'overwrite'
          ? 'Edit the name, then confirm.'
          : 'Give your template a descriptive name.'}
      </p>
      <input
        ref={inputRef}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        placeholder="e.g. Product Research"
        className={`${inputCls(ACCENT, true)} mb-5 py-2.5`}
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className={`${btnSecondary(true)} px-4 py-2 text-[13px]`}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!label.trim()}
          className={`${btnPrimary(ACCENT, true)} px-4 py-2 text-[13px]`}
        >
          {mode === 'overwrite' ? 'Update' : 'Save'}
        </button>
      </div>
    </ModalShell>
  )
}

/* ── Delete modal ─────────────────────────────────────────────────────────── */

function DeleteModal({
  template,
  onClose,
  onConfirm,
}: {
  template: Template | null
  onClose: () => void
  onConfirm: (id: TemplateId) => void
}) {
  if (!template) return null
  return (
    <ModalShell title="Delete template" onClose={onClose}>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mb-5 leading-relaxed">
        Are you sure you want to delete{' '}
        <span className="font-medium text-red-600 dark:text-red-400">{template.label}</span>?
        This can&apos;t be undone.
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className={`${btnSecondary(true)} px-4 py-2 text-[13px]`}>
          Cancel
        </button>
        <button
          onClick={() => onConfirm(template.id)}
          className={`${btnDanger(true)} px-4 py-2 text-[13px]`}
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </ModalShell>
  )
}

/* ── Import-from-MD modal ─────────────────────────────────────────────────── */

function ImportMdModal({
  onClose,
  onImport,
}: {
  onClose: () => void
  onImport: (messages: Message[]) => void
}) {
  const [mdText, setMdText] = useState('')
  const [preview, setPreview] = useState<Message[] | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const mdFileRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  function readFile(file: File) {
    const reader = new FileReader()
    reader.onload = (ev) => {
      setMdText(String(ev.target?.result ?? ''))
      setPreview(null)
      setError('')
    }
    reader.readAsText(file)
  }

  function handleConvert() {
    if (!mdText.trim()) {
      setError('Paste or upload an MD file first.')
      return
    }
    const result = convertMdToJson(mdText)
    if (result.length === 0) {
      setError(
        'No messages found. Supported formats: ChatGPT/Claude extension exports (## User / ## Assistant) and Perplexity page exports.'
      )
      setPreview(null)
      return
    }
    setError('')
    setPreview(result)
  }

  const detectedFormat = mdText.trim()
    ? isPerplexityMd(mdText)
      ? 'Perplexity'
      : 'ChatGPT / Claude'
    : null

  return (
    <ModalShell title="Import from MD" onClose={onClose}>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mb-4 leading-relaxed">
        Drag &amp; drop, upload, or paste an MD export from{' '}
        <span className="font-medium text-zinc-800 dark:text-white">ChatGPT</span>,{' '}
        <span className="font-medium text-zinc-800 dark:text-white">Claude</span>, or{' '}
        <span className="font-medium text-zinc-800 dark:text-white">Perplexity</span>.
      </p>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => mdFileRef.current?.click()}
          className={`${btnSecondary(true)} px-3 py-1.5 text-[13px]`}
        >
          <Download size={12} />
          Upload .md
        </button>
        <input
          ref={mdFileRef}
          type="file"
          accept=".md,.txt,.markdown"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) readFile(file)
            e.target.value = ''
          }}
          hidden
        />
        <button
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText()
              setMdText(text)
              setPreview(null)
              setError('')
            } catch {
              setError('Clipboard access denied. Paste manually.')
            }
          }}
          className={`${btnSecondary(true)} px-3 py-1.5 text-[13px]`}
        >
          <Copy size={12} />
          Paste
        </button>
        {detectedFormat && (
          <span className="ml-auto rounded-full border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/70 dark:bg-white/[0.04] px-2 py-0.5 text-[12px] font-medium text-zinc-500 dark:text-zinc-200">
            {detectedFormat}
          </span>
        )}
      </div>

      <div
        className="relative mb-3"
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragCounter.current++
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragCounter.current--
          if (dragCounter.current <= 0) {
            setDragging(false)
            dragCounter.current = 0
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragging(false)
          dragCounter.current = 0
          const file = e.dataTransfer?.files?.[0]
          if (file) readFile(file)
        }}
      >
        <textarea
          value={mdText}
          onChange={(e) => {
            setMdText(e.target.value)
            setPreview(null)
            setError('')
          }}
          placeholder="Paste your MD chat export here, or drag & drop a file…"
          rows={6}
          className={`${inputCls(ACCENT, true)} resize-none font-mono ${
            dragging ? 'border-sky-500/50 bg-sky-500/[0.04]' : ''
          }`}
        />
        {dragging && (
          // Transient drag highlight — no `.panel` here, per STYLING.md.
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-sky-500/[0.06] border-2 border-dashed border-sky-500/40 pointer-events-none">
            <span className="text-[13px] font-semibold text-zinc-800 dark:text-white">
              Drop .md file here
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-[13px] text-red-600 dark:text-red-400 mb-3 -mt-1">{error}</p>}

      {preview && (
        <div className="mb-4 rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] px-3.5 py-3 max-h-36 overflow-y-auto">
          <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
            ✓ {preview.length} message{preview.length !== 1 ? 's' : ''} found
          </p>
          {preview.slice(0, 6).map((m, i) => (
            <div key={i} className="flex gap-2 text-[12px] mb-1.5 leading-snug">
              <span className="shrink-0 font-bold tracking-wider text-zinc-700 dark:text-zinc-100">
                {m.sender}
              </span>
              <span className="text-zinc-500 dark:text-zinc-200 truncate">
                {m.message.slice(0, 100)}
                {m.message.length > 100 ? '…' : ''}
              </span>
            </div>
          ))}
          {preview.length > 6 && (
            <p className="text-[12px] text-zinc-500 dark:text-zinc-200 mt-1">
              …and {preview.length - 6} more
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className={`${btnSecondary(true)} px-4 py-2 text-[13px]`}>
          Cancel
        </button>
        {!preview ? (
          <button
            onClick={handleConvert}
            disabled={!mdText.trim()}
            className={`${btnSecondary(true)} px-4 py-2 text-[13px]`}
          >
            Convert
          </button>
        ) : (
          <button
            onClick={() => {
              onImport(preview)
              onClose()
            }}
            className={`${btnPrimary(ACCENT, true)} px-4 py-2 text-[13px]`}
          >
            Import {preview.length} message{preview.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </ModalShell>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ChatRecreatorPage() {
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  // Starts true: the loader only ever clears it, on the first fetch settling.
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [loadedTemplate, setLoadedTemplate] = useState<Template | null>(null)

  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [convertModalKey, setConvertModalKey] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const templateMenuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const [messages, setMessages] = useState<Message[]>([{ sender: '', message: '' }])
  const [segments, setSegments] = useState<Segment[]>([])
  const [rightSender, setRightSender] = useState<Sender>('ME')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const [history, setHistory] = useState<Snapshot[]>([])
  const [redoStack, setRedoStack] = useState<Snapshot[]>([])
  const [originalMessages, setOriginalMessages] = useState<Message[] | null>(null)

  const [inputMessage, setInputMessage] = useState('')
  const [inputSender, setInputSender] = useState<Sender>('ME')
  const [exportBaseName, setExportBaseName] = useState('chat')
  const [error, setError] = useState<string | null>(null)

  usePasteSanitizer()

  /* ── Fetch templates ─────────────────────────────────────────────────── */

  const fetchTemplates = useCallback(
    () =>
      fetch('/api/tools/chats')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load templates')
          return res.json()
        })
        .then((data: Template[]) => {
          setTemplates(data)
          setError(null)
        })
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'Failed to load templates')
        )
        .finally(() => setTemplatesLoading(false)),
    []
  )

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  /* ── Outside-click ───────────────────────────────────────────────────── */

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false)
      if (templateMenuRef.current && !templateMenuRef.current.contains(target))
        setTemplateMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── Derived ─────────────────────────────────────────────────────────── */

  const hasMessages = messages.some((m) => !(m.sender === '' && m.message === ''))
  const hasUndo = history.length > 0
  const hasRedo = redoStack.length > 0
  const canRestore = !!originalMessages

  /* ── Helpers ─────────────────────────────────────────────────────────── */

  function pushHistory(ms: Message[] = messages, ss: Segment[] = segments) {
    setHistory((p) => {
      const n = [...p, structuredClone({ messages: ms, segments: ss })]
      if (n.length > MAX_UNDO) n.shift()
      return n
    })
    setRedoStack([])
  }

  /** Map arbitrary role names onto our two senders: first seen is ME, rest AI. */
  function normalizeMessages(arr: Message[]): Message[] {
    const map: Record<string, Sender> = {}
    let nxt: Sender = 'ME'
    return arr.map((m) => {
      const s = m.sender ?? ''
      if (s === 'ME' || s === 'AI' || s === '')
        return { sender: s, message: m.message ?? '', sources: m.sources }
      if (!map[s]) {
        map[s] = nxt
        nxt = 'AI'
      }
      return { sender: map[s], message: m.message ?? '', sources: m.sources }
    })
  }

  /* ── Import ──────────────────────────────────────────────────────────── */

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    pushHistory(messages, segments)

    const off = messages.length
    const ns: Segment[] = []
    const nm: Message[] = []

    for (const f of files) {
      const text = await f.text()
      let raw: unknown = null
      try {
        raw = JSON.parse(text)
      } catch {
        raw = null
      }
      const parsed = withSources(
        normalizeMessages(Array.isArray(raw) ? (raw as Message[]) : parseMd(text))
      )
      setExportBaseName(f.name.replace(/\.[^/.]+$/, ''))
      ns.push({ name: f.name, startIndex: off + nm.length })
      nm.push(...parsed)
    }

    const merged = [...messages, ...nm]
    if (!originalMessages) setOriginalMessages(structuredClone(merged))
    setSegments((p) => [...p, ...ns])
    setMessages(merged)
    setLoadedTemplate(null)
    e.target.value = ''
  }

  /* ── Template load / save / delete ───────────────────────────────────── */

  function loadTemplate(tpl: Template) {
    pushHistory(messages, segments)
    setEditingIndex(null)
    const parsed = normalizeMessages(tpl.content)
    setMessages(parsed)
    setSegments([])
    setOriginalMessages(parsed)
    setLoadedTemplate(tpl)
    setExportBaseName(tpl.label.replace(/\s+/g, '-').toLowerCase())
  }

  async function handleSave({
    mode,
    label,
    id,
  }: {
    mode: 'new' | 'overwrite'
    label: string
    id?: TemplateId
  }) {
    const cleaned = messages.filter((m) => !(m.sender === '' && m.message === ''))
    try {
      const overwrite = mode === 'overwrite' && id
      const res = await fetch('/api/tools/chats', {
        method: overwrite ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overwrite ? { id, label, content: cleaned } : { label, content: cleaned }),
      })
      if (!res.ok) throw new Error('Save failed')
      setLoadedTemplate(await res.json())
      await fetchTemplates()
      setSaveModalOpen(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function handleDeleteTemplate(id: TemplateId) {
    try {
      const res = await fetch('/api/tools/chats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      if (loadedTemplate?.id === id) setLoadedTemplate(null)
      await fetchTemplates()
      setDeleteTarget(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  /* ── Message ops ─────────────────────────────────────────────────────── */

  function handleMdImport(parsed: Message[]) {
    pushHistory(messages, segments)
    const merged = [...messages, ...withSources(parsed)]
    if (!originalMessages) setOriginalMessages(structuredClone(merged))
    setMessages(merged)
    setLoadedTemplate(null)
  }

  function addMessage() {
    if (!inputMessage.trim()) return
    pushHistory()
    const { text, sources } = extractSources(inputMessage)
    setMessages((p) => [...p, { sender: inputSender, message: text, sources }])
    setInputMessage('')
  }

  function updateMessage(i: number, v: string) {
    setMessages((p) => {
      const u = [...p]
      const { text, sources } = extractSources(v, u[i].sources)
      u[i] = { ...u[i], message: text, sources }
      return u
    })
  }

  function deleteMessage(i: number) {
    pushHistory()
    setEditingIndex(null)
    setMessages((p) => p.filter((_, j) => j !== i))
  }

  function moveMessage(i: number, d: number) {
    const ni = i + d
    if (ni < 0 || ni >= messages.length) return
    pushHistory()
    setEditingIndex(null)
    setMessages((p) => {
      const a = [...p]
      ;[a[i], a[ni]] = [a[ni], a[i]]
      return a
    })
  }

  function flipSender(i: number) {
    pushHistory()
    setMessages((p) => {
      const a = [...p]
      a[i] = { ...a[i], sender: a[i].sender === 'ME' ? 'AI' : 'ME' }
      return a
    })
  }

  function clearChat() {
    if (!window.confirm('Clear the entire chat?')) return
    pushHistory()
    setEditingIndex(null)
    setMessages([{ sender: '', message: '' }])
    setSegments([])
    setOriginalMessages(null)
    setLoadedTemplate(null)
    setHistory([])
    setRedoStack([])
  }

  function restoreOriginal() {
    if (!originalMessages) return
    pushHistory()
    setEditingIndex(null)
    setMessages(originalMessages)
  }

  function undo() {
    if (!history.length) return
    setEditingIndex(null)
    setRedoStack((r) => [...r, structuredClone({ messages, segments })])
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))
    setMessages(prev.messages)
    setSegments(prev.segments)
  }

  function redo() {
    if (!redoStack.length) return
    setEditingIndex(null)
    const next = redoStack[redoStack.length - 1]
    setRedoStack((r) => r.slice(0, -1))
    setHistory((h) => [...h, structuredClone({ messages, segments })])
    setMessages(next.messages)
    setSegments(next.segments)
  }

  function exportMergedMD() {
    const md = toMd(messages)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const base = exportBaseName.trim() || 'chat'
    downloadBlob(blob, base + '.md')
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  const menuItem =
    'flex items-center gap-2 w-full text-left px-3.5 py-2.5 text-[13px] font-medium text-zinc-600 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors'

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen overflow-hidden">
      <div className="shrink-0 px-4 sm:px-8 pt-6 sm:pt-8">
        <ToolHeader
          tool={TOOL}
          compact
          actions={
            <>
              <div ref={templateMenuRef} className="relative">
                <button
                  onClick={() => setTemplateMenuOpen((o) => !o)}
                  className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}
                >
                  <Bookmark size={13} />
                  Templates
                </button>

                {templateMenuOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl overflow-hidden panel border border-zinc-200 dark:border-white/[0.08] bg-white/95 dark:bg-[rgba(14,14,24,0.92)] shadow-xl">
                    {templatesLoading && (
                      <div className="px-3.5 py-3 text-[13px] text-zinc-500 dark:text-zinc-200">
                        Loading…
                      </div>
                    )}
                    {!templatesLoading && templates.length === 0 && (
                      <div className="px-3.5 py-4 text-[13px] text-center text-zinc-500 dark:text-zinc-200">
                        No saved templates
                      </div>
                    )}
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="group/item flex items-center hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
                      >
                        <button
                          onClick={() => {
                            loadTemplate(tpl)
                            setTemplateMenuOpen(false)
                          }}
                          className="flex-1 min-w-0 truncate text-left px-3.5 py-2.5 text-[13px] text-zinc-600 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white transition-colors"
                        >
                          {tpl.label}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setTemplateMenuOpen(false)
                            setDeleteTarget(tpl)
                          }}
                          className="px-3 py-2.5 text-zinc-500 dark:text-zinc-200 opacity-0 group-hover/item:opacity-100 hover:text-red-500 dark:hover:text-red-400 transition-all"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {hasMessages && (
                <button
                  onClick={() => setSaveModalOpen(true)}
                  className={`${btnPrimary(ACCENT)} px-3 py-1.5 text-[13px]`}
                >
                  <Bookmark size={13} />
                  Save
                </button>
              )}

              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={`${btnSecondary()} p-1.5`}
                  title="More"
                >
                  <MoreVertical size={14} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl overflow-hidden panel border border-zinc-200 dark:border-white/[0.08] bg-white/95 dark:bg-[rgba(14,14,24,0.92)] shadow-xl">
                    {canRestore && (
                      <button
                        onClick={() => {
                          restoreOriginal()
                          setMenuOpen(false)
                        }}
                        className={menuItem}
                      >
                        <RotateCcw size={13} />
                        Restore import
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setConvertModalKey((k) => k + 1)
                        setConvertModalOpen(true)
                        setMenuOpen(false)
                      }}
                      className={menuItem}
                    >
                      <FileText size={13} />
                      Import from MD
                    </button>
                    {hasMessages && (
                      <>
                        <button
                          onClick={() => {
                            setRightSender((s) => (s === 'ME' ? 'AI' : 'ME'))
                            setMenuOpen(false)
                          }}
                          className={menuItem}
                        >
                          <ArrowLeftRight size={13} />
                          Switch sides
                        </button>
                        <button
                          onClick={() => {
                            clearChat()
                            setMenuOpen(false)
                          }}
                          className="flex items-center gap-2 w-full text-left px-3.5 py-2.5 text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={13} />
                          Clear chat
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          }
        />
      </div>

      {/* ═══ TOOLBAR ═══════════════════════════════════════════════════════ */}

      <div className="shrink-0 px-4 sm:px-8 flex flex-wrap items-center gap-2 pb-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}
        >
          <Download size={13} />
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.markdown,.json"
          multiple
          onChange={handleImport}
          hidden
        />

        {hasMessages && (
          <>
            <button
              onClick={exportMergedMD}
              className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}
            >
              <Upload size={13} />
              Export
            </button>
            <div className="flex items-center panel rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03] px-2.5 py-1 text-[13px] min-w-24 max-w-48">
              <input
                type="text"
                value={exportBaseName}
                onChange={(e) => setExportBaseName(e.target.value)}
                className="min-w-0 flex-1 bg-transparent outline-none text-zinc-700 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400"
                placeholder="chat"
              />
              <span className="select-none text-zinc-500 dark:text-zinc-200">.md</span>
            </div>
          </>
        )}

        <div className="flex-1" />

        {hasUndo && (
          <button onClick={undo} className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}>
            <Undo2 size={13} />
            Undo
          </button>
        )}
        {hasRedo && (
          <button onClick={redo} className={`${btnSecondary()} px-3 py-1.5 text-[13px]`}>
            <Redo2 size={13} />
            Redo
          </button>
        )}

        {loadedTemplate && (
          <span className="inline-flex items-center gap-1.5 rounded-full panel border border-sky-500/25 bg-sky-500/[0.08] px-2.5 py-1 text-[12px] font-medium text-sky-700 dark:text-sky-100">
            <Bookmark size={11} />
            {loadedTemplate.label}
          </span>
        )}
      </div>

      {error && (
        <div className="shrink-0 px-4 sm:px-8 pb-2">
          <p className="text-[13px] text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ═══ CHAT AREA ═════════════════════════════════════════════════════ */}

      <div className="flex-1 min-h-0 px-4 sm:px-8">
        <div className={`${CARD_CLS} h-full overflow-hidden`}>
          <div className="h-full overflow-y-auto px-4 sm:px-6 py-5 scroll-smooth">
            {!hasMessages && (
              <EmptyState
                icon={MessagesSquare}
                title="Import a file or load a template to begin"
              />
            )}

            {messages.map((msg, index) => {
              if (msg.sender === '' && msg.message === '') return null
              const isRight = msg.sender === rightSender
              const isMe = msg.sender === 'ME'
              const isEditing = editingIndex === index
              const divider = segments.find((s) => s.startIndex === index)

              return (
                <React.Fragment key={index}>
                  {divider && <Divider text={divider.name} />}
                  <div
                    className={`group/msg flex mb-3 ${isRight ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex ${
                        isRight ? 'justify-end' : 'justify-start'
                      } w-full sm:w-[72%] gap-1.5`}
                    >
                      {/* Reorder arrows */}
                      <div
                        className={`flex flex-col gap-0.5 shrink-0 ${
                          isRight ? 'order-first' : 'order-last'
                        }`}
                      >
                        <button
                          onClick={() => moveMessage(index, -1)}
                          className="p-0.5 rounded text-zinc-500 dark:text-zinc-200 opacity-0 group-hover/msg:opacity-100 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all duration-150"
                          title="Move up"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          onClick={() => moveMessage(index, 1)}
                          className="p-0.5 rounded text-zinc-500 dark:text-zinc-200 opacity-0 group-hover/msg:opacity-100 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all duration-150"
                          title="Move down"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>

                      {/* Bubble + actions */}
                      <div className="flex flex-col w-full min-w-0">
                        <div
                          className={`w-full px-4 py-3 rounded-2xl transition-shadow duration-150 ${
                            isMe
                              // Darker, not lighter: the chat card is already a frosted panel, so a
                            // white lift on top of it barely separates the two senders.
                            ? 'border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/70 dark:bg-black/40'
                              : ''
                          } hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)]`}
                        >
                          {isEditing ? (
                            <AutoResizeTextarea
                              value={msg.message}
                              autoFocus
                              onFocus={() => pushHistory(messages)}
                              onChange={(e) => updateMessage(index, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setEditingIndex(null)
                              }}
                              rows={1}
                              className="w-full text-sm bg-transparent resize-none outline-none overflow-hidden leading-relaxed text-zinc-800 dark:text-zinc-100"
                            />
                          ) : (
                            <MessageMarkdown text={msg.message} sources={msg.sources} />
                          )}
                        </div>

                        <div
                          className={`flex gap-0.5 mt-1 px-1 ${
                            isRight ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <button
                            onClick={() => navigator.clipboard.writeText(messages[index].message)}
                            className="p-1 rounded text-zinc-500 dark:text-zinc-200 opacity-0 group-hover/msg:opacity-100 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all duration-150"
                            title="Copy"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => flipSender(index)}
                            className="p-1 rounded text-zinc-500 dark:text-zinc-200 opacity-0 group-hover/msg:opacity-100 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all duration-150"
                            title="Flip sender"
                          >
                            <ArrowLeftRight size={14} />
                          </button>
                          <button
                            onClick={() => deleteMessage(index)}
                            className="p-1 rounded text-zinc-500 dark:text-zinc-200 opacity-0 group-hover/msg:opacity-100 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-150"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Sticky edit toggle — stays centred while a tall
                          message scrolls past. */}
                      <div
                        className={`flex flex-col justify-center shrink-0 w-6 ${
                          isRight ? 'order-last' : 'order-first'
                        }`}
                      >
                        <button
                          onClick={() => setEditingIndex(isEditing ? null : index)}
                          className={`sticky top-1/2 -translate-y-1/2 p-1 rounded transition-all duration-150 hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${
                            isEditing
                              ? 'text-zinc-900 dark:text-white'
                              : 'text-zinc-500 dark:text-zinc-200 opacity-0 group-hover/msg:opacity-100 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                          title={isEditing ? 'Done editing' : 'Edit message'}
                        >
                          {isEditing ? <Check size={14} /> : <Pencil size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══ COMPOSE BAR ═══════════════════════════════════════════════════ */}

      <div className="shrink-0 px-4 sm:px-8 py-3">
        <div className="flex items-end gap-1 p-1.5 panel rounded-2xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] focus-within:border-sky-500/40 transition-colors duration-200">
          {/* Sender toggle — the container is the panel, the active pill is not. */}
          <div className="flex shrink-0 self-end mb-[3px] ml-0.5 rounded-lg overflow-hidden border border-zinc-200 dark:border-white/[0.07]">
            {(['AI', 'ME'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setInputSender(s)}
                className={`px-3 py-1.5 text-[12px] font-bold tracking-wider uppercase transition-all duration-150 ${
                  rightSender === s ? 'order-last' : ''
                } ${
                  inputSender === s
                    ? 'bg-sky-500/20 text-sky-700 dark:text-sky-100'
                    : 'text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <AutoResizeTextarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                addMessage()
              }
            }}
            rows={1}
            placeholder="Type a message…"
            className="flex-1 min-w-0 bg-transparent resize-none text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 outline-none px-2.5 py-2 max-h-48 leading-relaxed"
          />

          <button
            onClick={addMessage}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-sky-500/90 hover:bg-sky-500 text-white dark:bg-sky-500/25 dark:hover:bg-sky-500/40 dark:text-sky-100 hover:scale-105 active:scale-95 transition-all duration-150 mb-px mr-px"
            title="Add message"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* ═══ MODALS ════════════════════════════════════════════════════════ */}

      <SaveModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSave}
        loadedTemplate={loadedTemplate}
      />
      <DeleteModal
        template={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTemplate}
      />
      {convertModalOpen && (
        <ImportMdModal
          key={convertModalKey}
          onClose={() => setConvertModalOpen(false)}
          onImport={handleMdImport}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════════════════ */

function getScrollParent(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement
  while (p) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
    p = p.parentElement
  }
  return null
}

/**
 * Textarea that grows to fit its content. Measuring resets scrollHeight, which
 * would otherwise jump the surrounding scroller — hence the save/restore.
 */
function AutoResizeTextarea({
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const sp = getScrollParent(el)
    const ss = sp?.scrollTop
    const ws = window.scrollY
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
    if (sp && ss !== undefined) sp.scrollTop = ss
    window.scrollTo(0, ws)
  }, [value])
  return <textarea ref={ref} value={value} {...props} />
}

function Divider({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-zinc-200 dark:bg-white/[0.08]" />
      <span className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
        {text}
      </span>
      <div className="flex-1 h-px bg-zinc-200 dark:bg-white/[0.08]" />
    </div>
  )
}
