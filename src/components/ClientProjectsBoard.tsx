'use client'

// The delivery board on /client-projects.
//
// Two audiences read the same list. An admin gets the editor — new project,
// pencil, delete. A co-worker account gets exactly the same cards with none
// of those controls, which is why `canManage` gates rendering rather than the
// data: there is one board, not a second read-only copy of it to keep in step.
//
// The server actions check the session for themselves (see requireAdmin in
// lib/actions); hiding a button is a courtesy, not the lock.

import { useMemo, useState, useTransition } from 'react'
import {
  Briefcase, CalendarClock, CircleAlert, ExternalLink, Loader2, Pencil, Plus,
  Trash2, X,
} from 'lucide-react'
import {
  CLIENT_PROJECT_STATUSES,
  type ClientProject,
  type ClientProjectStatus,
} from '@/lib/supabase'
import {
  createClientProject,
  deleteClientProject,
  updateClientProject,
  type ClientProjectInput,
} from '@/lib/actions'
import CustomSelect from './CustomSelect'

// ── Status ───────────────────────────────────────────────────────────────────

const STATUS: Record<ClientProjectStatus, { label: string; chip: string; bar: string }> = {
  planning:    { label: 'Planning',    chip: 'border-zinc-300/60 dark:border-white/[0.08] panel bg-zinc-500/10 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-100', bar: '#a1a1aa' },
  in_progress: { label: 'In progress', chip: 'border-indigo-500/25 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300', bar: '#6366f1' },
  review:      { label: 'In review',   chip: 'border-amber-500/25 bg-amber-500/15 text-amber-700 dark:text-amber-300', bar: '#f59e0b' },
  live:        { label: 'Live',        chip: 'border-emerald-500/25 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', bar: '#10b981' },
  paused:      { label: 'Paused',      chip: 'border-rose-500/25 bg-rose-500/15 text-rose-700 dark:text-rose-300', bar: '#f43f5e' },
}

const STATUS_OPTIONS = CLIENT_PROJECT_STATUSES.map((value) => ({
  value,
  label: STATUS[value].label,
}))

// ── Dates ────────────────────────────────────────────────────────────────────

function fmtDue(due: string): string {
  const [y, m, d] = due.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Whole days from today to `due`. Negative once it has passed. */
function daysUntil(due: string): number {
  const [y, m, d] = due.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function dueTone(due: string, status: ClientProjectStatus): string {
  // A shipped project's date is history, not a deadline — it never turns red.
  if (status === 'live') return 'text-zinc-500 dark:text-zinc-200'
  const days = daysUntil(due)
  if (days < 0) return 'text-rose-600 dark:text-rose-400'
  if (days <= 7) return 'text-amber-600 dark:text-amber-400'
  return 'text-zinc-500 dark:text-zinc-200'
}

// ── Shared classes ───────────────────────────────────────────────────────────

const inputClass =
  'w-full panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/[0.16] transition-colors'

const labelClass =
  'block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1.5'

const EMPTY: ClientProjectInput = {
  name: '',
  client: '',
  description: '',
  status: 'planning',
  progress: 0,
  due_date: null,
  url: '',
  note: '',
}

// ── Board ────────────────────────────────────────────────────────────────────

export default function ClientProjectsBoard({
  initialProjects,
  canManage,
  supabaseConfigured,
}: {
  initialProjects: ClientProject[]
  canManage: boolean
  supabaseConfigured: boolean
}) {
  const [projects, setProjects] = useState(initialProjects)
  const [editing, setEditing] = useState<ClientProject | 'new' | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const stats = useMemo(() => {
    const live = projects.filter((p) => p.status === 'live').length
    const active = projects.filter(
      (p) => p.status === 'in_progress' || p.status === 'review'
    ).length
    // Averaged over the unfinished ones only — counting shipped projects at
    // 100% would make the number climb as work is delivered rather than done.
    const open = projects.filter((p) => p.status !== 'live')
    const avg = open.length
      ? Math.round(open.reduce((sum, p) => sum + p.progress, 0) / open.length)
      : 0
    return { total: projects.length, live, active, avg }
  }, [projects])

  function save(input: ClientProjectInput, existing: ClientProject | null) {
    setError('')
    startTransition(async () => {
      try {
        if (existing) {
          const saved = await updateClientProject(existing.id, input)
          setProjects((list) => list.map((p) => (p.id === saved.id ? saved : p)))
        } else {
          const created = await createClientProject(input)
          setProjects((list) => [...list, created])
        }
        setEditing(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save')
      }
    })
  }

  function remove(project: ClientProject) {
    setError('')
    startTransition(async () => {
      try {
        await deleteClientProject(project.id)
        setProjects((list) => list.filter((p) => p.id !== project.id))
        setEditing(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete')
      }
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 sm:mb-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
            Delivery
          </p>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
            Client Projects
          </h1>
          <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-200 leading-relaxed">
            Every project being delivered, and where each one stands.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setEditing('new')}
            disabled={!supabaseConfigured}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-[13px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            <Plus size={14} />
            New project
          </button>
        )}
      </div>

      {/* Stats */}
      {projects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Projects" value={String(stats.total)} />
          <Stat label="In flight" value={String(stats.active)} accent="text-indigo-600 dark:text-indigo-400" />
          <Stat label="Live" value={String(stats.live)} accent="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Avg progress" value={`${stats.avg}%`} />
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-start gap-2.5 px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.07]">
          <CircleAlert size={14} className="shrink-0 mt-0.5 text-rose-500" />
          <p className="text-[13px] text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}

      {/* Cards */}
      {projects.length === 0 ? (
        <EmptyState canManage={canManage} onCreate={() => setEditing('new')} />
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canManage={canManage}
              onEdit={() => setEditing(project)}
            />
          ))}
        </ul>
      )}

      {canManage && editing && (
        <ProjectDialog
          project={editing === 'new' ? null : editing}
          pending={pending}
          onCancel={() => { setEditing(null); setError('') }}
          onSave={(input) => save(input, editing === 'new' ? null : editing)}
          onDelete={editing === 'new' ? undefined : () => remove(editing)}
        />
      )}
    </div>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-white/60 dark:bg-white/[0.02] px-4 py-3.5">
      <p className="text-[12px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${accent ?? 'text-zinc-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  )
}

function ProgressBar({
  value,
  status,
  label,
}: {
  value: number
  status: ClientProjectStatus
  label: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-1 h-1.5 rounded-full panel bg-zinc-200/80 dark:bg-white/[0.08] overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress on ${label}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${value}%`, backgroundColor: STATUS[status].bar }}
        />
      </div>
      <span className="w-12 text-right text-[13px] font-semibold tabular-nums text-zinc-700 dark:text-white">
        {value}%
      </span>
    </div>
  )
}

function ProjectCard({
  project,
  canManage,
  onEdit,
}: {
  project: ClientProject
  canManage: boolean
  onEdit: () => void
}) {
  const status = STATUS[project.status]

  return (
    <li className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-white/60 dark:bg-white/[0.02] px-4 sm:px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-tight truncate">
              {project.name}
            </h2>
            <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[12px] font-medium ${status.chip}`}>
              {status.label}
            </span>
          </div>
          {project.client && (
            <p className="mt-1 text-[13px] font-medium text-zinc-600 dark:text-zinc-200">
              {project.client}
            </p>
          )}
        </div>

        {canManage && (
          <button
            onClick={onEdit}
            title={`Edit ${project.name}`}
            aria-label={`Edit ${project.name}`}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition-all"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      {project.description && (
        <p className="mt-2.5 text-[13px] text-zinc-500 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
          {project.description}
        </p>
      )}

      <div className="mt-3.5">
        <ProgressBar value={project.progress} status={project.status} label={project.name} />
      </div>

      {project.note && (
        <p className="mt-3 px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] text-[13px] text-zinc-600 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
          {project.note}
        </p>
      )}

      {(project.due_date || project.url) && (
        <div className="mt-3 flex items-center gap-4 flex-wrap">
          {project.due_date && (
            <span className={`flex items-center gap-1.5 text-[13px] ${dueTone(project.due_date, project.status)}`}>
              <CalendarClock size={13} />
              {fmtDue(project.due_date)}
            </span>
          )}
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 min-w-0 text-[13px] text-zinc-500 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <ExternalLink size={13} className="shrink-0" />
              <span className="truncate">{project.url.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
      )}
    </li>
  )
}

function EmptyState({ canManage, onCreate }: { canManage: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-white/[0.08] px-6 py-14 text-center">
      <Briefcase size={22} className="mx-auto text-zinc-300 dark:text-zinc-600" />
      <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-white">No projects yet</p>
      <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-200">
        {canManage
          ? 'Add the first one and it shows up here for everyone with access.'
          : 'Nothing has been added to the board yet.'}
      </p>
      {canManage && (
        <button
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-[13px] font-medium text-white hover:bg-indigo-500 transition-all active:scale-[0.98]"
        >
          <Plus size={14} />
          New project
        </button>
      )}
    </div>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────────

function ProjectDialog({
  project,
  pending,
  onCancel,
  onSave,
  onDelete,
}: {
  project: ClientProject | null
  pending: boolean
  onCancel: () => void
  onSave: (input: ClientProjectInput) => void
  onDelete?: () => void
}) {
  const [form, setForm] = useState<ClientProjectInput>(() =>
    project
      ? {
          name: project.name,
          client: project.client,
          description: project.description,
          status: project.status,
          progress: project.progress,
          due_date: project.due_date,
          url: project.url,
          note: project.note,
        }
      : EMPTY
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function set<K extends keyof ClientProjectInput>(key: K, value: ClientProjectInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-lg my-8 rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[rgba(14,14,22,0.97)] shadow-2xl">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-200 dark:border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
            {project ? 'Edit project' : 'New project'}
          </h2>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.07] transition-all"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div>
            <label className={labelClass} htmlFor="cp-name">Project</label>
            <input
              id="cp-name"
              autoFocus
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Webshop rebuild"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="cp-client">Client</label>
            <input
              id="cp-client"
              value={form.client}
              onChange={(e) => set('client', e.target.value)}
              placeholder="Atrium"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={labelClass}>Status</span>
              <CustomSelect
                value={form.status}
                onChange={(v) => set('status', v as ClientProjectStatus)}
                options={STATUS_OPTIONS}
                ariaLabel="Status"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="cp-due">Due</label>
              <input
                id="cp-due"
                type="date"
                value={form.due_date ?? ''}
                onChange={(e) => set('due_date', e.target.value || null)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="cp-progress">
              Progress — {form.progress}%
            </label>
            <input
              id="cp-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.progress}
              onChange={(e) => set('progress', Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="cp-desc">Description</label>
            <textarea
              id="cp-desc"
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What the project covers."
              className={`${inputClass} resize-y`}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="cp-note">Latest update</label>
            <textarea
              id="cp-note"
              rows={2}
              value={form.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="What is happening on this right now."
              className={`${inputClass} resize-y`}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="cp-url">Link</label>
            <input
              id="cp-url"
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://staging.example.com"
              className={inputClass}
            />
          </div>
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
                  Delete for good
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-2 py-1.5 text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors"
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"
              >
                <Trash2 size={13} />
                Delete
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
              Cancel
            </button>
            <button
              onClick={() => onSave({ ...form, name: form.name.trim(), client: form.client.trim() })}
              disabled={!form.name.trim() || pending}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-[13px] font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {pending && <Loader2 size={13} className="animate-spin" />}
              {project ? 'Save' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
