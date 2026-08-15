'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import type { OngoingActivity, Person, Task } from '@/lib/supabase'
import {
  createOngoingActivity,
  deleteOngoingActivity,
  setOngoingArchived,
  updateOngoingActivity,
  type OngoingActivityInput,
} from '@/lib/actions'
import { PERSON_COLORS, resolvePersonColor } from '@/lib/people'
import {
  Activity,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

// Two tones only: everything in flight reads indigo, a finished card turns
// emerald so the ones waiting to be archived stand out at a glance.
const IN_PROGRESS_ACCENT = '#6366f1'
const COMPLETE_ACCENT = '#10b981'

/** States are free text, so the chip picks its tone from what was typed. */
function stateTone(state: string): string {
  const s = state.toLowerCase()
  if (/block|stuck|issue|problem/.test(s))
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25'
  if (/wait|review|feedback|approval|paused|hold/.test(s))
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25'
  if (/done|finish|complete|ship/.test(s))
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
  return 'bg-zinc-500/10 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 border-zinc-300/60 dark:border-white/[0.08]'
}

const STATE_PRESETS = [
  'Just started',
  'In progress',
  'Waiting on feedback',
  'Blocked',
  'In review',
  'Almost done',
]

function relativeDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const inputClass =
  'w-full bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

const labelClass =
  'block text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-1.5'

// ── Board ────────────────────────────────────────────────────────────────────

export default function OngoingBoard({
  initialActivities,
  tasks,
  people,
  supabaseConfigured,
}: {
  initialActivities: OngoingActivity[]
  tasks: Task[]
  people: Person[]
  supabaseConfigured: boolean
}) {
  const [activities, setActivities] = useState<OngoingActivity[]>(initialActivities)
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; activity: OngoingActivity } | null>(null)
  const [personFilter, setPersonFilter] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)

  // Colour is a function of the person's slot in the list, so resolve it once.
  const personMap = useMemo(
    () => new Map(people.map((p, i) => [p.id, { person: p, color: resolvePersonColor(p, i) }])),
    [people]
  )
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  /** A tracked card follows its task's title; the stored one is the fallback. */
  function titleOf(a: OngoingActivity) {
    const live = a.task_id ? taskMap.get(a.task_id)?.title : null
    return (live || a.title || 'Untitled').trim() || 'Untitled'
  }

  const live = activities.filter((a) => !a.archived)
  const archived = activities.filter((a) => a.archived)
  const visible = personFilter ? live.filter((a) => a.person_id === personFilter) : live

  const complete = live.filter((a) => a.progress >= 100).length
  const avgProgress = live.length
    ? Math.round(live.reduce((sum, a) => sum + a.progress, 0) / live.length)
    : 0

  function upsertLocal(saved: OngoingActivity) {
    setActivities((prev) => {
      const i = prev.findIndex((a) => a.id === saved.id)
      if (i === -1) return [...prev, saved]
      const next = [...prev]
      next[i] = saved
      return next
    })
  }

  function patchLocal(id: string, updates: Partial<OngoingActivity>) {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)))
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
        <div>
          <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2 sm:mb-3">
            Right now
          </p>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
            Ongoing
          </h1>
        </div>
        {supabaseConfigured && (
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-lime-500/20 bg-lime-500/15 hover:bg-lime-500/25 text-lime-700 dark:text-lime-300 text-[13px] font-medium transition-all duration-150 shrink-0"
          >
            <Plus size={13} />
            New Card
          </button>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatTile
          label="In flight"
          value={String(live.length - complete)}
          sub={`${live.length} card${live.length !== 1 ? 's' : ''} on the board`}
        />
        <StatTile
          label="Ready to archive"
          value={String(complete)}
          sub={complete ? 'at 100% — archive when confirmed' : 'nothing finished yet'}
        />
        <StatTile label="Average progress" value={`${avgProgress}%`} sub={`${archived.length} archived`} />
      </div>

      {/* Person filter */}
      {people.length > 0 && live.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-6">
          <FilterChip active={personFilter === null} onClick={() => setPersonFilter(null)} label="Everyone" count={live.length} />
          {people.map((p) => {
            const count = live.filter((a) => a.person_id === p.id).length
            if (count === 0) return null
            return (
              <FilterChip
                key={p.id}
                active={personFilter === p.id}
                onClick={() => setPersonFilter(personFilter === p.id ? null : p.id)}
                label={p.name}
                count={count}
                dot={PERSON_COLORS[personMap.get(p.id)?.color ?? 'indigo']?.swatch}
              />
            )
          })}
        </div>
      )}

      {/* Cards */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 sm:py-28 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
          <div className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] flex items-center justify-center mb-4">
            <Activity size={16} className="text-zinc-400 dark:text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500 mb-1">
            {!supabaseConfigured
              ? 'Supabase not connected'
              : personFilter
                ? 'Nothing ongoing for this person'
                : 'Nothing ongoing yet'}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-700">
            {supabaseConfigured
              ? 'Hit "New Card" to track a task or log an activity'
              : 'Add env vars to start saving'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visible.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              title={titleOf(a)}
              person={a.person_id ? personMap.get(a.person_id) : undefined}
              taskMissing={!!a.task_id && !taskMap.has(a.task_id)}
              onEdit={() => setModal({ mode: 'edit', activity: a })}
              onPatch={(updates) => patchLocal(a.id, updates)}
            />
          ))}
        </div>
      )}

      {/* Archive */}
      {archived.length > 0 && (
        <div className="mt-10">
          <button
            onClick={() => setArchiveOpen((o) => !o)}
            className="flex items-center gap-2 text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors mb-4"
          >
            {archiveOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived
            <span className="text-[11px] font-normal text-zinc-400 dark:text-zinc-600">{archived.length}</span>
          </button>
          {archiveOpen && (
            <div className="space-y-2">
              {archived.map((a) => (
                <ArchivedRow
                  key={a.id}
                  activity={a}
                  title={titleOf(a)}
                  person={a.person_id ? personMap.get(a.person_id)?.person : undefined}
                  onRestored={() => patchLocal(a.id, { archived: false, archived_at: null })}
                  onDeleted={() => setActivities((prev) => prev.filter((x) => x.id !== a.id))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <ActivityModal
          activity={modal.mode === 'edit' ? modal.activity : null}
          tasks={tasks}
          people={people}
          activities={activities}
          onClose={() => setModal(null)}
          onSaved={(saved) => {
            upsertLocal(saved)
            setModal(null)
          }}
          onDeleted={(id) => {
            setActivities((prev) => prev.filter((x) => x.id !== id))
            setModal(null)
          }}
        />
      )}
    </>
  )
}

// ── Small pieces ─────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] p-5">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">
        {label}
      </p>
      <p className="text-[26px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight mb-1">{value}</p>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-600">{sub}</p>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  dot,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  dot?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
        active
          ? 'border-zinc-300 dark:border-white/[0.16] bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-zinc-100'
          : 'border-zinc-200 dark:border-white/[0.06] bg-transparent text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-white/[0.04]'
      }`}
    >
      {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
      {label}
      <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{count}</span>
    </button>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  title,
  person,
  taskMissing,
  onEdit,
  onPatch,
}: {
  activity: OngoingActivity
  title: string
  person?: { person: Person; color: string }
  taskMissing: boolean
  onEdit: () => void
  onPatch: (updates: Partial<OngoingActivity>) => void
}) {
  const [archiving, startArchive] = useTransition()

  // Read-only here — the bar is a status display, and the slider that moves it
  // lives in the edit modal.
  const progress = activity.progress
  const done = progress >= 100
  const accent = done ? COMPLETE_ACCENT : IN_PROGRESS_ACCENT

  function handleArchive() {
    startArchive(async () => {
      await setOngoingArchived(activity.id, true)
      onPatch({ archived: true, archived_at: new Date().toISOString() })
    })
  }

  const chip = person ? PERSON_COLORS[person.color] ?? PERSON_COLORS.indigo : null

  return (
    <div
      className={`group rounded-2xl border p-4 transition-colors ${
        done
          ? 'border-emerald-500/30 bg-emerald-500/[0.06] dark:bg-emerald-500/[0.07]'
          : 'border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100/70 dark:hover:bg-white/[0.05]'
      }`}
    >
      {/* Who + actions */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {chip ? (
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${chip.chip}`}>
              <User size={10} />
              {person!.person.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-200/70 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400">
              <User size={10} />
              Unassigned
            </span>
          )}
          {activity.task_id && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-700 dark:text-violet-300"
              title={taskMissing ? 'The linked task no longer exists' : 'Tracking a task from the board'}
            >
              <Link2 size={9} />
              {taskMissing ? 'Task removed' : 'Task'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/[0.06] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={handleArchive}
            disabled={archiving}
            className={`flex items-center gap-1 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40 ${
              done
                ? 'px-2 py-1.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
                : 'p-1.5 text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/[0.06] opacity-0 group-hover:opacity-100 focus:opacity-100'
            }`}
            title="Archive"
          >
            {archiving ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
            {done && 'Archive'}
          </button>
        </div>
      </div>

      {/* What */}
      <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mb-2 break-words">
        {title}
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {activity.state ? (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${stateTone(activity.state)}`}>
            {activity.state}
          </span>
        ) : (
          <button
            onClick={onEdit}
            className="text-[11px] text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            + add a state
          </button>
        )}
        {done && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            <CircleCheck size={11} />
            Complete — archive it when you&apos;re happy
          </span>
        )}
      </div>

      {/* Progress — display only, edited through the modal */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-1.5 rounded-full bg-zinc-200/80 dark:bg-white/[0.08] overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress for ${title}`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%`, backgroundColor: accent }}
          />
        </div>
        <span
          className={`w-12 text-right text-[13px] font-semibold tabular-nums ${
            done ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-200'
          }`}
        >
          {progress}%
        </span>
      </div>
    </div>
  )
}

// ── Archived row ─────────────────────────────────────────────────────────────

function ArchivedRow({
  activity,
  title,
  person,
  onRestored,
  onDeleted,
}: {
  activity: OngoingActivity
  title: string
  person?: Person
  onRestored: () => void
  onDeleted: () => void
}) {
  const [pending, start] = useTransition()

  function handleRestore() {
    start(async () => {
      await setOngoingArchived(activity.id, false)
      onRestored()
    })
  }

  function handleDelete() {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return
    start(async () => {
      await deleteOngoingActivity(activity.id)
      onDeleted()
    })
  }

  return (
    <div className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.02] px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 truncate">{title}</p>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-600">
          {person?.name ?? 'Unassigned'} · {activity.progress}% · archived {relativeDate(activity.archived_at)}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleRestore}
          disabled={pending}
          className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
          title="Put back on the board"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />}
        </button>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="p-1.5 rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ── Add / edit modal ─────────────────────────────────────────────────────────

function ActivityModal({
  activity,
  tasks,
  people,
  activities,
  onClose,
  onSaved,
  onDeleted,
}: {
  activity: OngoingActivity | null
  tasks: Task[]
  people: Person[]
  activities: OngoingActivity[]
  onClose: () => void
  onSaved: (saved: OngoingActivity) => void
  onDeleted: (id: string) => void
}) {
  const [source, setSource] = useState<'task' | 'activity'>(activity?.task_id ? 'task' : 'activity')
  const [taskId, setTaskId] = useState(activity?.task_id ?? '')
  const [personId, setPersonId] = useState(activity?.person_id ?? '')
  const [name, setName] = useState(activity?.title ?? '')
  const [state, setState] = useState(activity?.state ?? '')
  const [progress, setProgress] = useState(activity?.progress ?? 0)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const [deleting, startDelete] = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Every open task, minus the ones another live card already tracks.
  const trackedElsewhere = useMemo(
    () =>
      new Set(
        activities
          .filter((a) => !a.archived && a.task_id && a.id !== activity?.id)
          .map((a) => a.task_id as string)
      ),
    [activities, activity?.id]
  )

  const openTasks = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks
      .filter((t) => !t.done)
      .filter((t) => (q ? t.title.toLowerCase().includes(q) : true))
      .slice(0, 60)
  }, [tasks, query])

  const selectedTask = taskId ? tasks.find((t) => t.id === taskId) ?? null : null

  function pickTask(t: Task) {
    setTaskId(t.id)
    // The task's assignee is who's doing it, unless someone was already chosen.
    if (t.assignee_id && !personId) setPersonId(t.assignee_id)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (source === 'task' && !taskId) { setError('Pick a task to track'); return }
    if (source === 'activity' && !name.trim()) { setError('Give the activity a name'); return }
    if (!personId) { setError('Pick who is doing it'); return }
    setError('')

    const input: OngoingActivityInput = {
      task_id: source === 'task' ? taskId : null,
      person_id: personId,
      // A tracked card stores the task title so it survives the task's deletion.
      title: source === 'task' ? (selectedTask?.title ?? name).trim() : name.trim(),
      state: state.trim(),
      progress,
    }

    start(async () => {
      try {
        const saved = activity
          ? await updateOngoingActivity(activity.id, input)
          : await createOngoingActivity(input)
        onSaved(saved)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function handleDelete() {
    if (!activity) return
    if (!confirm('Delete this card? This can\'t be undone.')) return
    startDelete(async () => {
      await deleteOngoingActivity(activity.id)
      onDeleted(activity.id)
    })
  }

  const accent = progress >= 100 ? COMPLETE_ACCENT : IN_PROGRESS_ACCENT

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="h-1 w-full bg-gradient-to-r from-lime-500/60 via-emerald-500/60 to-teal-500/60" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.04] flex items-center justify-center">
                <Activity size={15} className="text-lime-600 dark:text-lime-400" />
              </div>
              <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
                {activity ? 'Edit card' : 'New ongoing card'}
              </h2>
            </div>
            <button onClick={onClose} className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Source toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08]">
              {(
                [
                  { key: 'task', label: 'Track a task', icon: <Link2 size={12} /> },
                  { key: 'activity', label: 'New activity', icon: <Activity size={12} /> },
                ] as const
              ).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSource(s.key)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    source === s.key
                      ? 'bg-white dark:bg-white/[0.1] text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>

            {source === 'task' ? (
              <div>
                <label className={labelClass}>Task</label>
                <div className="relative mb-2">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search open tasks…"
                    className={`${inputClass} pl-8 py-2`}
                  />
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 dark:border-white/[0.08] divide-y divide-zinc-100 dark:divide-white/[0.05]">
                  {openTasks.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-zinc-400 dark:text-zinc-600 text-center">
                      {tasks.some((t) => !t.done) ? 'No task matches that' : 'No open tasks on the board'}
                    </p>
                  ) : (
                    openTasks.map((t) => {
                      const taken = trackedElsewhere.has(t.id)
                      const selected = t.id === taskId
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={taken}
                          onClick={() => pickTask(t)}
                          className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${
                            selected
                              ? 'bg-lime-500/15 text-zinc-900 dark:text-zinc-100'
                              : taken
                                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                          }`}
                        >
                          <span className="block truncate">{t.title || 'Untitled'}</span>
                          {taken && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">already being tracked</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>Activity name</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Reworking the Atrium onboarding flow"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className={labelClass}>Assigned to</label>
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">Pick a person…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {people.length === 0 && (
                <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
                  Add people on the Tasks page first.
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>State</label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Where are you at with it?"
                className={inputClass}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {STATE_PRESETS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setState(s)}
                    className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                      state === s
                        ? stateTone(s)
                        : 'border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Progress</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="slider flex-1"
                  style={{ '--slider-accent': accent, '--slider-fill': `${progress}%` } as React.CSSProperties}
                />
                <span className="w-12 text-right text-[13px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                  {progress}%
                </span>
              </div>
              {progress >= 100 && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                  Stays on the board until someone archives it.
                </p>
              )}
            </div>

            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="flex items-center justify-between gap-2 pt-1">
              {activity ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition-colors"
                >
                  {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-lime-500/20 border border-lime-500/20 text-lime-700 dark:text-lime-300 hover:bg-lime-500/30 disabled:opacity-40 transition-colors"
                >
                  {pending && <Loader2 size={11} className="animate-spin" />}
                  {pending ? 'Saving…' : activity ? 'Save Changes' : 'Add Card'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
