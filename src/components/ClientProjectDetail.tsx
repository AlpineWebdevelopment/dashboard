'use client'

// One client project: its steps as a board, and the full roadmap under it.
//
// The cards are deliberately the same object the Tasks board renders — same
// priority themes, same 12px meta chips, same rounded-xl panel-card shell — so
// that reading this page feels like reading /tasks. They import those constants
// from TaskCardView rather than restating them, which is what keeps the two
// from drifting when the board's palette next changes.
//
// What they are NOT is the same data. These rows live in client_project_tasks
// and belong to a project rather than a list, which is what lets the co-worker
// account read them without being handed the personal board.

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CalendarClock, Check, ChevronDown, CircleAlert, ExternalLink,
  Loader2, Map as MapIcon, Pencil, Plus, Trash2, User, X,
} from 'lucide-react'
import type {
  ClientProject,
  ClientProjectTask,
  ClientTaskPhase,
} from '@/lib/supabase'
import {
  createClientProjectTask,
  deleteClientProjectTask,
  saveClientProjectRoadmap,
  updateClientProjectTask,
  type ClientProjectTaskInput,
} from '@/lib/actions'
import { PRIORITY_LABELS, PRIORITY_THEMES, PRIORITY_TINTS } from './TaskCardView'
import CustomSelect from './CustomSelect'

// ── Columns ──────────────────────────────────────────────────────────────────

/**
 * Four fixed columns rather than editable lists. A client project's shape is
 * the same every time — one thing in hand, a sequence behind it, the work that
 * runs alongside, and everything agreed but not scheduled — and letting these
 * be renamed would only let two projects disagree about what "next" means.
 *
 * Colours follow COLUMN_COLORS on the Tasks board, in its order.
 */
const PHASES: {
  key: ClientTaskPhase
  title: string
  hint: string
  dot: string
  text: string
}[] = [
  { key: 'now',      title: 'Most',          hint: 'Ami épp kézben van',        dot: 'bg-indigo-400',  text: 'text-indigo-600 dark:text-indigo-300' },
  { key: 'next',     title: 'Sorban',        hint: 'Egymásra épülő lépések',    dot: 'bg-violet-400',  text: 'text-violet-600 dark:text-violet-300' },
  { key: 'parallel', title: 'Párhuzamosan',  hint: 'Mellette fut',              dot: 'bg-sky-400',     text: 'text-sky-600 dark:text-sky-300' },
  { key: 'later',    title: 'Később',        hint: 'Megbeszélve, nem ütemezve', dot: 'bg-amber-400',   text: 'text-amber-600 dark:text-amber-300' },
]

const PHASE_OPTIONS = PHASES.map((p) => ({ value: p.key, label: p.title }))

const PRIORITY_OPTIONS = (['none', 'low', 'medium', 'high'] as const).map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}))

const STATUS_LABELS: Record<ClientProject['status'], string> = {
  planning: 'Planning',
  in_progress: 'In progress',
  review: 'In review',
  live: 'Live',
  paused: 'Paused',
}

const STATUS_CHIPS: Record<ClientProject['status'], string> = {
  planning:    'border-zinc-300/60 dark:border-white/[0.08] panel bg-zinc-500/10 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-100',
  in_progress: 'border-indigo-500/25 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  review:      'border-amber-500/25 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  live:        'border-emerald-500/25 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  paused:      'border-rose-500/25 bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

const inputClass =
  'w-full panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

const labelClass =
  'block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1.5'

const EMPTY_TASK: ClientProjectTaskInput = {
  title: '',
  description: '',
  phase: 'next',
  priority: 'none',
  done: false,
  owner: '',
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('hu-HU', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ClientProjectDetail({
  project,
  initialTasks,
  canManage,
}: {
  project: ClientProject
  initialTasks: ClientProjectTask[]
  canManage: boolean
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [editing, setEditing] = useState<ClientProjectTask | ClientTaskPhase | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const byPhase = useMemo(() => {
    const map = new Map<ClientTaskPhase, ClientProjectTask[]>(PHASES.map((p) => [p.key, []]))
    for (const task of tasks) map.get(task.phase)?.push(task)
    return map
  }, [tasks])

  const openCount = tasks.filter((t) => !t.done).length

  function run(work: () => Promise<void>) {
    setError('')
    startTransition(async () => {
      try {
        await work()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nem sikerült menteni')
      }
    })
  }

  function save(input: ClientProjectTaskInput, existing: ClientProjectTask | null) {
    run(async () => {
      if (existing) {
        const saved = await updateClientProjectTask(existing.id, input)
        setTasks((list) => list.map((t) => (t.id === saved.id ? saved : t)))
      } else {
        const created = await createClientProjectTask(project.id, input)
        setTasks((list) => [...list, created])
      }
      setEditing(null)
    })
  }

  function toggleDone(task: ClientProjectTask) {
    // Optimistic: ticking a card off is the most-repeated action here, and a
    // round trip before the strike-through lands makes it feel broken.
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))
    run(async () => {
      try {
        await updateClientProjectTask(task.id, { done: !task.done })
      } catch (err) {
        setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)))
        throw err
      }
    })
  }

  function remove(task: ClientProjectTask) {
    run(async () => {
      await deleteClientProjectTask(task.id)
      setTasks((list) => list.filter((t) => t.id !== task.id))
      setEditing(null)
    })
  }

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-6xl">

        {/* ── Header ── */}
        <Link
          href="/client-projects"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors mb-5"
        >
          <ArrowLeft size={13} />
          Client Projects
        </Link>

        <div className="mb-7 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
                {project.name}
              </h1>
              <span className={`px-2 py-0.5 rounded-md border text-[12px] font-medium ${STATUS_CHIPS[project.status]}`}>
                {STATUS_LABELS[project.status]}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 flex-wrap text-[13px] text-zinc-500 dark:text-zinc-200">
              {project.client && <span className="font-medium">{project.client}</span>}
              {project.due_date && (
                <span className="flex items-center gap-1.5">
                  <CalendarClock size={13} />
                  {fmtDate(project.due_date)}
                </span>
              )}
              {project.url && (
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <ExternalLink size={13} />
                  {project.url.replace(/^https?:\/\//, '')}
                </a>
              )}
              <span className="tabular-nums">
                {openCount} nyitott / {tasks.length} lépés
              </span>
            </div>
          </div>

          {canManage && (
            <button
              onClick={() => setEditing('now')}
              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-[13px] font-medium text-white hover:bg-indigo-500 transition-all active:scale-[0.98]"
            >
              <Plus size={14} />
              Új lépés
            </button>
          )}
        </div>

        {project.description && (
          <p className="mb-6 max-w-3xl text-[13px] text-zinc-500 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
            {project.description}
          </p>
        )}

        {project.note && (
          <div className="mb-6 max-w-3xl rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-3">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-indigo-600 dark:text-indigo-300 mb-1">
              Legutóbbi állás
            </p>
            <p className="text-[13px] text-zinc-700 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">
              {project.note}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.07]">
            <CircleAlert size={14} className="shrink-0 mt-0.5 text-rose-500" />
            <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>
          </div>
        )}

        {/* ── Board ── */}
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 sm:-mx-8 sm:px-8">
          {PHASES.map((phase) => {
            const cards = byPhase.get(phase.key) ?? []
            return (
              <div
                key={phase.key}
                className="w-[19rem] shrink-0 flex flex-col rounded-2xl border border-zinc-200 dark:border-white/[0.07] panel bg-zinc-50/60 dark:bg-white/[0.02] p-2.5"
              >
                <div className="flex items-center gap-2 px-1 mb-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${phase.dot}`} />
                  <span className={`text-[13px] font-semibold ${phase.text}`}>{phase.title}</span>
                  <span className="text-[13px] text-zinc-500 dark:text-zinc-200 tabular-nums ml-auto">
                    {cards.length}
                  </span>
                </div>
                <p className="px-1 mb-2.5 text-[12px] text-zinc-500 dark:text-zinc-200">{phase.hint}</p>

                <div className="flex flex-col gap-2">
                  {cards.map((task) => (
                    <StepCard
                      key={task.id}
                      task={task}
                      canManage={canManage}
                      onToggleDone={() => toggleDone(task)}
                      onEdit={() => setEditing(task)}
                    />
                  ))}

                  {cards.length === 0 && (
                    <p className="px-1 py-6 text-center text-[13px] text-zinc-500 dark:text-zinc-200">
                      Üres
                    </p>
                  )}

                  {canManage && (
                    <button
                      onClick={() => setEditing(phase.key)}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.10] text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.18] transition-all"
                    >
                      <Plus size={13} />
                      Lépés
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Roadmap ── */}
        <Roadmap
          projectId={project.id}
          initial={project.roadmap ?? ''}
          canManage={canManage}
          onError={setError}
        />
      </div>

      {canManage && editing && (
        <StepDialog
          task={typeof editing === 'string' ? null : editing}
          defaultPhase={typeof editing === 'string' ? editing : editing.phase}
          pending={pending}
          onCancel={() => { setEditing(null); setError('') }}
          onSave={(input) => save(input, typeof editing === 'string' ? null : editing)}
          onDelete={typeof editing === 'string' ? undefined : () => remove(editing)}
        />
      )}
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function StepCard({
  task,
  canManage,
  onToggleDone,
  onEdit,
}: {
  task: ClientProjectTask
  canManage: boolean
  onToggleDone: () => void
  onEdit: () => void
}) {
  // A finished step drops its priority tint and sits back, exactly as an
  // archived card does on the Tasks board.
  const effective = task.done ? 'none' : task.priority
  const theme = PRIORITY_THEMES[effective]

  const tintVars = (
    PRIORITY_TINTS[effective] ? { '--card-priority': PRIORITY_TINTS[effective] } : {}
  ) as React.CSSProperties

  return (
    <div
      style={tintVars}
      className={`group relative panel-card rounded-xl border transition-all duration-150 overflow-hidden shadow-sm ${theme.bg} ${theme.border} ${
        task.done ? 'opacity-60 hover:opacity-100' : 'hover:brightness-95 dark:hover:brightness-110'
      }`}
    >
      <div className="px-3.5 py-3">
        <div className="flex items-start gap-2">
          <button
            onClick={onToggleDone}
            disabled={!canManage}
            aria-label={task.done ? `${task.title} visszanyitása` : `${task.title} kész`}
            title={task.done ? 'Visszanyitás' : 'Kész'}
            className={`mt-0.5 shrink-0 w-4 h-4 rounded-[5px] border flex items-center justify-center transition-all ${
              task.done
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-zinc-300 dark:border-white/[0.18] text-transparent hover:border-emerald-500'
            } ${canManage ? '' : 'cursor-default'}`}
          >
            <Check size={10} strokeWidth={3} />
          </button>

          <p
            className={`flex-1 min-w-0 text-sm leading-snug transition-colors ${
              task.done
                ? 'text-zinc-500 dark:text-zinc-200 line-through decoration-zinc-400/50 dark:decoration-zinc-600'
                : 'text-zinc-700 dark:text-zinc-100 group-hover:text-zinc-900 dark:group-hover:text-white'
            }`}
          >
            {task.title}
          </p>

          {canManage && (
            <button
              onClick={onEdit}
              aria-label={`${task.title} szerkesztése`}
              title="Szerkesztés"
              className="shrink-0 w-6 h-6 -mr-1 -mt-0.5 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition-all"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>

        {task.description && (
          <p className="text-[12px] leading-snug text-zinc-500 dark:text-zinc-200 mt-1.5 ml-6 whitespace-pre-line">
            {task.description}
          </p>
        )}

        {(task.owner || task.priority !== 'none') && (
          <div className="flex items-center gap-2 mt-2.5 ml-6 flex-wrap">
            {task.owner && (
              <span className="flex items-center gap-1 text-[12px] font-medium px-1.5 py-0.5 rounded-md panel bg-zinc-100 dark:bg-white/[0.05] text-zinc-500 dark:text-zinc-200 max-w-full">
                <User size={9} className="shrink-0" />
                <span className="truncate">{task.owner}</span>
              </span>
            )}
            {task.priority !== 'none' && !task.done && (
              <span
                className={`text-[12px] font-medium px-1.5 py-0.5 rounded-md ${
                  task.priority === 'high'
                    ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400'
                    : task.priority === 'medium'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                }`}
              >
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Roadmap ──────────────────────────────────────────────────────────────────

/**
 * The whole plan, under the board.
 *
 * The cards are the working surface — what is in hand, what is next. This is
 * the reasoning behind them, which does not fit on a card and should not be
 * cut down until it does. Collapsed by default so it never pushes the board
 * off the screen.
 *
 * Rendered rather than stored as HTML: a line beginning `## ` is a heading, one
 * beginning `- ` is a bullet, everything else is a paragraph. That is the whole
 * grammar, which is enough for a plan and leaves nothing to sanitise.
 */
function Roadmap({
  projectId,
  initial,
  canManage,
  onError,
}: {
  projectId: string
  initial: string
  canManage: boolean
  onError: (message: string) => void
}) {
  const [text, setText] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editingRoadmap, setEditingRoadmap] = useState(false)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await saveClientProjectRoadmap(projectId, draft)
        setText(draft)
        setEditingRoadmap(false)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Nem sikerült menteni az útitervet')
      }
    })
  }

  const blocks = useMemo(() => renderRoadmap(text), [text])

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-white/60 dark:bg-white/[0.02] overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.04] flex items-center justify-center">
            <MapIcon size={15} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-tight">
              Teljes útiterv
            </h2>
            <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-200 leading-relaxed">
              A háttér a kártyák mögött — miért ebben a sorrendben, és mi maradt nyitva.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {canManage && open && !editingRoadmap && (
            <button
              onClick={() => { setDraft(text); setEditingRoadmap(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-all"
            >
              <Pencil size={12} />
              Szerkesztés
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-all"
          >
            {open ? 'Összecsuk' : 'Megnyit'}
            <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="px-5 sm:px-6 pb-5">
          {editingRoadmap ? (
            <div className="flex flex-col gap-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={20}
                className={`${inputClass} font-mono text-[13px] leading-relaxed resize-y`}
                placeholder={'## Szakasz címe\n- Egy pont\nSima bekezdés.'}
              />
              <p className="text-[12px] text-zinc-500 dark:text-zinc-200">
                <code className="font-mono">##</code> sor = cím, <code className="font-mono">-</code> sor = felsorolás, minden más bekezdés.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={pending}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-[13px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-all active:scale-[0.98]"
                >
                  {pending && <Loader2 size={13} className="animate-spin" />}
                  Mentés
                </button>
                <button
                  onClick={() => setEditingRoadmap(false)}
                  className="px-3 py-2 rounded-xl text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
                >
                  Mégse
                </button>
              </div>
            </div>
          ) : blocks.length === 0 ? (
            <p className="text-[13px] text-zinc-500 dark:text-zinc-200">
              Még nincs útiterv ehhez a projekthez.
            </p>
          ) : (
            <div className="max-w-3xl flex flex-col gap-1">{blocks}</div>
          )}
        </div>
      )}
    </section>
  )
}

/** See the note on `Roadmap` — three line kinds, nothing else. */
function renderRoadmap(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const lines = text.split('\n')
  let bullets: string[] = []

  function flush(key: number) {
    if (bullets.length === 0) return
    out.push(
      <ul key={`u${key}`} className="my-1 flex flex-col gap-1.5">
        {bullets.map((b, i) => (
          <li
            key={i}
            className="relative pl-4 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-200 before:absolute before:left-0 before:top-[0.65em] before:w-1.5 before:h-px before:bg-zinc-400 dark:before:bg-zinc-500"
          >
            {b}
          </li>
        ))}
      </ul>
    )
    bullets = []
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (line.startsWith('## ')) {
      flush(i)
      out.push(
        <h3 key={i} className="mt-4 first:mt-0 mb-1 text-[13px] font-semibold tracking-widest uppercase text-zinc-700 dark:text-white">
          {line.slice(3)}
        </h3>
      )
    } else if (line.startsWith('- ')) {
      bullets.push(line.slice(2))
    } else if (line.trim() === '') {
      flush(i)
    } else {
      flush(i)
      out.push(
        <p key={i} className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-200">
          {line}
        </p>
      )
    }
  })
  flush(lines.length)

  return out
}

// ── Editor ───────────────────────────────────────────────────────────────────

function StepDialog({
  task,
  defaultPhase,
  pending,
  onCancel,
  onSave,
  onDelete,
}: {
  task: ClientProjectTask | null
  defaultPhase: ClientTaskPhase
  pending: boolean
  onCancel: () => void
  onSave: (input: ClientProjectTaskInput) => void
  onDelete?: () => void
}) {
  const [form, setForm] = useState<ClientProjectTaskInput>(() =>
    task
      ? {
          title: task.title,
          description: task.description,
          phase: task.phase,
          priority: task.priority,
          done: task.done,
          owner: task.owner,
        }
      : { ...EMPTY_TASK, phase: defaultPhase }
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function set<K extends keyof ClientProjectTaskInput>(key: K, value: ClientProjectTaskInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-lg my-8 rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[rgba(14,14,22,0.97)] shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-200 dark:border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
            {task ? 'Lépés szerkesztése' : 'Új lépés'}
          </h2>
          <button
            onClick={onCancel}
            aria-label="Bezárás"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition-all"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div>
            <label className={labelClass} htmlFor="cpt-title">Lépés</label>
            <input
              id="cpt-title"
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Leltár a GHL-ben"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="cpt-desc">Leírás</label>
            <textarea
              id="cpt-desc"
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Mit jelent ez pontosan."
              className={`${inputClass} resize-y`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={labelClass}>Oszlop</span>
              <CustomSelect
                value={form.phase}
                onChange={(v) => set('phase', v as ClientTaskPhase)}
                options={PHASE_OPTIONS}
                ariaLabel="Oszlop"
              />
            </div>
            <div>
              <span className={labelClass}>Prioritás</span>
              <CustomSelect
                value={form.priority}
                onChange={(v) => set('priority', v as ClientProjectTask['priority'])}
                options={PRIORITY_OPTIONS}
                ariaLabel="Prioritás"
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="cpt-owner">Kié</label>
            <input
              id="cpt-owner"
              value={form.owner}
              onChange={(e) => set('owner', e.target.value)}
              placeholder="Domi"
              className={inputClass}
            />
          </div>

          <label className="flex items-center gap-2.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-100 cursor-pointer">
            <input
              type="checkbox"
              checked={form.done}
              onChange={(e) => set('done', e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            Kész
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-zinc-200 dark:border-white/[0.06]">
          {onDelete ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onDelete}
                  disabled={pending}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-[13px] font-medium text-white hover:bg-rose-500 disabled:opacity-40 transition-all"
                >
                  Végleges törlés
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-2 py-1.5 text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
                >
                  Marad
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
              >
                <Trash2 size={13} />
                Törlés
              </button>
            )
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
            >
              Mégse
            </button>
            <button
              onClick={() => onSave({ ...form, title: form.title.trim(), owner: form.owner.trim() })}
              disabled={!form.title.trim() || pending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-[13px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {pending && <Loader2 size={13} className="animate-spin" />}
              {task ? 'Mentés' : 'Létrehozás'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
