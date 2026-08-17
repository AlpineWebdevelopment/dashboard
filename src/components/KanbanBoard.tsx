'use client'

import { useTransition, useState, useMemo, useRef, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { List, Person, Project, Task } from '@/lib/supabase'
import {
  createList,
  renameList,
  deleteList,
  createTask,
  updateTask,
  deleteTask,
  updateTasks,
  deleteTasks,
  setTaskColors,
  reorderCards,
  reorderLists,
  createProject,
  renameProject,
  deleteProject,
  setProjectColor,
  setTaskProject,
  createPerson,
  deletePerson,
  setPersonColor,
  setTaskAssignee,
} from '@/lib/actions'
import { ARCHIVE_COOKIE, setPrefCookie } from '@/lib/prefs'
import { PERSON_COLORS, PERSON_COLOR_KEYS, resolvePersonColor } from '@/lib/people'
import ProjectBar, { PROJECT_COLORS, resolveProjectColor } from './ProjectBar'
import CustomSelect from './CustomSelect'
import TaskCardView, { CARD_STRIPS, PRIORITY_LABELS, toDateKey } from './TaskCardView'
import { Plus, X, MoreHorizontal, Trash2, Loader2, Check, ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight, GripVertical, Folder, User, UserRound, ArrowLeftRight, Archive } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

// Solid dot/flag colours — the priority *tint* of a card lives in PRIORITY_THEMES.
const PRIORITY_COLORS: Record<Task['priority'], string> = {
  none: 'bg-zinc-400 dark:bg-zinc-600',
  low: 'bg-sky-400',
  medium: 'bg-amber-400',
  high: 'bg-rose-400',
}

function priorityNext(p: Task['priority']): Task['priority'] {
  const order: Task['priority'][] = ['none', 'low', 'medium', 'high']
  return order[(order.indexOf(p) + 1) % order.length]
}

// ── Card Modal ────────────────────────────────────────────────────────────────

function CardModal({
  task,
  projects,
  people,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: Task
  projects: Project[]
  people: Person[]
  onClose: () => void
  onUpdate: (updates: Partial<Task>) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description ?? '')
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [projectId, setProjectId] = useState(task.project_id ?? '')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [deleting, setDeleting] = useState(false)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function triggerSave(overrides: { title?: string; desc?: string; priority?: Task['priority']; dueDate?: string } = {}) {
    const vals = {
      title: overrides.title ?? title,
      desc: overrides.desc ?? desc,
      priority: overrides.priority ?? priority,
      dueDate: overrides.dueDate ?? dueDate,
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    setSaveStatus('idle')
    timerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      const updates = {
        title: vals.title.trim() || task.title,
        description: vals.desc,
        priority: vals.priority,
        due_date: vals.dueDate || null,
      }
      onUpdate(updates)
      await updateTask(task.id, updates)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 600)
  }

  const selectedProjectIdx = projects.findIndex((p) => p.id === projectId)
  const selectedProjectColor =
    selectedProjectIdx >= 0 ? resolveProjectColor(projects[selectedProjectIdx], selectedProjectIdx) : null

  const selectedPersonIdx = people.findIndex((p) => p.id === assigneeId)
  const selectedPersonColor =
    selectedPersonIdx >= 0 ? resolvePersonColor(people[selectedPersonIdx], selectedPersonIdx) : null

  // Discrete choice — saved right away rather than through the debounce.
  async function handleProjectChange(value: string) {
    const next = value || null
    setProjectId(value)
    onUpdate({ project_id: next })
    setSaveStatus('saving')
    await setTaskProject(task.id, next)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  async function handleAssigneeChange(value: string) {
    const next = value || null
    setAssigneeId(value)
    onUpdate({ assignee_id: next })
    setSaveStatus('saving')
    await setTaskAssignee(task.id, next)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  async function handleDelete() {
    setDeleting(true)
    onDelete()
    await deleteTask(task.id)
    onClose()
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* No overflow-hidden — the dropdowns need to spill past the modal edge */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl">
        {/* Accent line — the card's colour, same as on the board */}
        <div className={`h-1 w-full rounded-t-2xl ${CARD_STRIPS[task.color] || 'panel bg-zinc-200 dark:bg-white/[0.07]'}`} />

        <div className="p-6 space-y-5">
          {/* Title row + save indicator + close */}
          <div className="flex items-start gap-3">
            <input
              className="flex-1 bg-transparent text-xl font-semibold text-zinc-900 dark:text-white outline-none placeholder-zinc-500 dark:placeholder-zinc-400"
              value={title}
              onChange={(e) => { setTitle(e.target.value); triggerSave({ title: e.target.value }) }}
              placeholder="Card title"
            />
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <span className="flex items-center gap-1 text-[13px] h-4">
                {saveStatus === 'saving' && <Loader2 size={10} className="animate-spin text-zinc-500 dark:text-zinc-200" />}
                {saveStatus === 'saved'  && <Check size={10} className="text-emerald-500" />}
              </span>
              <button onClick={onClose} className="text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">Description</p>
            <textarea
              ref={descRef}
              className="w-full min-h-[80px] panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/[0.15] resize-none transition-colors"
              value={desc}
              placeholder="Add a description…"
              onChange={(e) => { setDesc(e.target.value); autoResize(e.target); triggerSave({ desc: e.target.value }) }}
              onFocus={(e) => autoResize(e.target)}
            />
          </div>

          {/* Priority + Due date */}
          <div className="flex gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">Priority</p>
              <button
                onClick={() => { const next = priorityNext(priority); setPriority(next); triggerSave({ priority: next }) }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.07] panel bg-zinc-50 dark:bg-white/[0.03] text-sm text-zinc-700 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors w-full"
              >
                <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[priority]}`} />
                {PRIORITY_LABELS[priority]}
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">Due date</p>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); triggerSave({ dueDate: e.target.value }) }}
                className="w-full min-w-0 panel bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.07] rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-white/[0.15] transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Project */}
          <div>
            <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">Project</p>
            {projects.length === 0 ? (
              <p className="text-[13px] text-zinc-500 dark:text-zinc-200 italic">
                No projects yet — create one above the board.
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Folder size={14} className={`shrink-0 ${selectedProjectColor ? PROJECT_COLORS[selectedProjectColor].icon : 'text-zinc-500 dark:text-zinc-200'}`} />
                <CustomSelect
                  value={projectId}
                  onChange={handleProjectChange}
                  className="flex-1"
                  options={[
                    { value: '', label: 'No project' },
                    ...projects.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </div>
            )}
          </div>

          {/* Assignee */}
          <div>
            <p className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">Assigned to</p>
            {people.length === 0 ? (
              <p className="text-[13px] text-zinc-500 dark:text-zinc-200 italic">
                No people yet — add someone via the person button above the board.
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <User size={14} className={`shrink-0 ${selectedPersonColor ? PERSON_COLORS[selectedPersonColor].icon : 'text-zinc-500 dark:text-zinc-200'}`} />
                <CustomSelect
                  value={assigneeId}
                  onChange={handleAssigneeChange}
                  className="flex-1"
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...people.map((p) => ({ value: p.id, label: p.name })),
                  ]}
                />
              </div>
            )}
          </div>

          {/* Delete only — no Save/Cancel */}
          <div className="pt-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={12} />
              Delete card
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Person Picker Modal ───────────────────────────────────────────────────────

function PersonPickerModal({
  people,
  activePersonId,
  onSelect,
  onCreate,
  onDelete,
  onSetColor,
  onClose,
}: {
  people: Person[]
  activePersonId: string | null
  onSelect: (id: string | null) => void
  onCreate: (name: string) => void
  onDelete: (id: string) => void
  onSetColor: (id: string, color: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [pickerId, setPickerId] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!pickerId) return
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerId])

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    onCreate(n)
    setName('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* No overflow-hidden — the colour swatches need to spill past the modal edge */}
      <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Whose tasks?</h2>
            <button onClick={onClose} className="text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => { onSelect(null); onClose() }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-left transition-colors ${
                activePersonId === null
                  ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400'
                  : 'text-zinc-700 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
              }`}
            >
              <UserRound size={14} className="shrink-0" />
              Everyone
              {activePersonId === null && <Check size={13} className="ml-auto shrink-0" />}
            </button>

            {people.map((p, i) => {
              const tint = PERSON_COLORS[resolvePersonColor(p, i)]
              const isActive = activePersonId === p.id
              return (
                <div
                  key={p.id}
                  ref={pickerId === p.id ? pickerRef : undefined}
                  className={`group relative flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-xl transition-colors ${
                    isActive ? 'bg-indigo-500/10' : 'hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {/* Person icon doubles as the colour button — this tint is what
                      their "assigned to" chip wears on the board. */}
                  <button
                    onClick={() => setPickerId((id) => (id === p.id ? null : p.id))}
                    title={`Colour: ${tint.label}`}
                    className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] transition-colors"
                  >
                    <User size={14} className={tint.icon} />
                  </button>

                  <button
                    onClick={() => { onSelect(p.id); onClose() }}
                    className={`flex-1 min-w-0 flex items-center gap-2 text-sm text-left transition-colors ${
                      isActive
                        ? 'text-indigo-500 dark:text-indigo-400'
                        : 'text-zinc-700 dark:text-zinc-100'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {isActive && <Check size={13} className="ml-auto shrink-0" />}
                  </button>

                  <button
                    onClick={() => onDelete(p.id)}
                    title={`Remove ${p.name}`}
                    className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all dark:text-zinc-200"
                  >
                    <Trash2 size={12} />
                  </button>

                  {pickerId === p.id && (
                    <div className="absolute top-full left-2 mt-1 z-50 flex gap-1 p-1.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#17171f] shadow-xl">
                      {PERSON_COLOR_KEYS.map((key) => (
                        <button
                          key={key}
                          onClick={() => { onSetColor(p.id, key); setPickerId(null) }}
                          title={PERSON_COLORS[key].label}
                          className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${PERSON_COLORS[key].swatch} ${
                            resolvePersonColor(p, i) === key ? 'ring-2 ring-offset-1 ring-zinc-400 dark:ring-white/40 dark:ring-offset-[#17171f]' : ''
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <form onSubmit={handleAdd} className="flex items-center gap-2 pt-1 border-t border-zinc-200 dark:border-white/[0.07]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add a person…"
              className="flex-1 mt-3 panel bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.07] rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-white/[0.15] transition-colors"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="mt-3 p-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Add Card Form ─────────────────────────────────────────────────────────────

function AddCardForm({
  listId,
  projectId,
  assigneeId,
  onAdd,
  onCancel,
}: {
  listId: string
  projectId: string | null
  assigneeId: string | null
  onAdd: (task: Task) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    startTransition(async () => {
      // New cards land in whichever project/person view is currently active
      const task = await createTask(t, 'none', null, listId, Date.now(), projectId, assigneeId)
      if (task) {
        onAdd(task)
        setTitle('')
        ref.current?.focus()
      }
    })
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 space-y-2">
      <textarea
        ref={ref}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          autoResize(e.target)
        }}
        onKeyDown={onKey}
        placeholder="Enter a title for this card…"
        rows={2}
        className="w-full panel bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 outline-none focus:border-indigo-500/40 resize-none transition-colors"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add card
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors dark:text-zinc-200"
        >
          <X size={14} />
        </button>
      </div>
    </form>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  { bg: 'bg-zinc-200 dark:bg-zinc-700', key: '' },
  { bg: 'bg-rose-400',    key: 'red'    },
  { bg: 'bg-orange-400',  key: 'orange' },
  { bg: 'bg-amber-400',   key: 'yellow' },
  { bg: 'bg-emerald-400', key: 'green'  },
  { bg: 'bg-sky-400',     key: 'blue'   },
  { bg: 'bg-violet-400',  key: 'purple' },
  { bg: 'bg-pink-400',    key: 'pink'   },
]

// Card colours live on `tasks.color` (supabase-task-color.sql), so a colour picked
// here shows up on every device. Before that column existed they were kept
// per-browser in localStorage — those are handed over to the DB on first load and
// the keys dropped. Without the migration the writes fail and localStorage stays
// the store, so the picker keeps working either way.
const CARD_COLORS_MIGRATED = 'card-colors-migrated'

function storeCardColor(taskId: string, color: string) {
  if (color) localStorage.setItem(`card-color:${taskId}`, color)
  else localStorage.removeItem(`card-color:${taskId}`)
}

// Only colours the DB doesn't already know about — a colour on the row is the
// newer of the two, since every write since the migration went there first.
function legacyCardColors(tasks: Task[]): Record<string, string> {
  if (typeof window === 'undefined') return {}
  if (localStorage.getItem(CARD_COLORS_MIGRATED) === '1') return {}
  const map: Record<string, string> = {}
  for (const t of tasks) {
    if (t.color) continue
    const stored = localStorage.getItem(`card-color:${t.id}`)
    if (stored) map[t.id] = stored
  }
  return map
}

// Person colours prefer the `people.color` column, but that's an optional
// migration (supabase-people-color.sql) — without it the picker still works,
// it just keeps the choice in this browser.
function getStoredPersonColor(personId: string) {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(`person-color:${personId}`) ?? ''
}

function storePersonColor(personId: string, color: string) {
  if (color) localStorage.setItem(`person-color:${personId}`, color)
  else localStorage.removeItem(`person-color:${personId}`)
}

function KanbanCard({
  task,
  project,
  assignee,
  isDragging,
  isSelected,
  isArchived,
  onSetColor,
  onToggleSelect,
  onDragStart,
  onDragEnd,
  onClick,
  onMoveToDone,
  onMoveUp,
  onMoveDown,
}: {
  task: Task
  project: { name: string; color: string } | null
  assignee: { name: string; color: string } | null
  isDragging: boolean
  isSelected: boolean
  isArchived: boolean
  onSetColor: (key: string) => void
  onToggleSelect: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onClick: () => void
  onMoveToDone?: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showPicker) return
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  // `|| ''` also covers rows loaded before the tasks.color migration.
  const colorKey = task.color || ''

  return (
    <TaskCardView
      task={task}
      project={project}
      assignee={assignee}
      isArchived={isArchived}
      isDragging={isDragging}
      isSelected={isSelected}
      interactive
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <>
        {/* Bottom action row */}
        <div className="flex items-center justify-between mt-2.5 gap-1">
          {/* Select + up/down arrows */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
              title={isSelected ? 'Deselect card' : 'Select card'}
              className={`w-4 h-4 mr-1 rounded-full border flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'border-zinc-300 dark:border-white/20 text-transparent hover:border-indigo-400 hover:scale-110'
              }`}
            >
              <Check size={10} strokeWidth={3} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveUp() }}
              title="Move up"
              className="p-1 rounded-md panel bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.12] hover:text-zinc-800 dark:hover:text-white transition-all"
            >
              <ChevronUp size={11} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveDown() }}
              title="Move down"
              className="p-1 rounded-md panel bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.12] hover:text-zinc-800 dark:hover:text-white transition-all"
            >
              <ChevronDown size={11} />
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {/* Color picker */}
            <div className="relative" ref={pickerRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowPicker((s) => !s) }}
                title="Set color"
                className="w-4 h-4 rounded-full border border-zinc-300 dark:border-white/20 hover:scale-110 transition-transform overflow-hidden"
              >
                <span className={`block w-full h-full rounded-full ${COLOR_SWATCHES.find(s => s.key === colorKey)?.bg ?? 'bg-zinc-300 dark:bg-zinc-600'}`} />
              </button>
              {showPicker && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full right-0 mb-1.5 flex gap-1 p-1.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#17171f] shadow-xl z-50"
                >
                  {COLOR_SWATCHES.map((s) => (
                    <button
                      key={s.key}
                      onClick={(e) => { e.stopPropagation(); onSetColor(s.key); setShowPicker(false) }}
                      className={`w-4 h-4 rounded-full ${s.bg} hover:scale-125 transition-transform ${colorKey === s.key ? 'ring-2 ring-offset-1 ring-zinc-400 dark:ring-white/40' : ''}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Done button */}
            {onMoveToDone && (
              <button
                onClick={(e) => { e.stopPropagation(); onMoveToDone() }}
                className="flex items-center gap-1 text-[12px] font-medium px-1.5 py-0.5 rounded-md border border-emerald-500/30 text-emerald-400/70 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/50 transition-all"
              >
                <Check size={9} />
                Done
              </button>
            )}
          </div>
        </div>
      </>
    </TaskCardView>
  )
}

// ── Column color palette ──────────────────────────────────────────────────────

const COLUMN_COLORS = [
  { dot: 'bg-violet-400', text: 'text-violet-300', bar: 'bg-violet-400/60', ring: 'ring-violet-500/20' },
  { dot: 'bg-amber-400',  text: 'text-amber-300',  bar: 'bg-amber-400/60',  ring: 'ring-amber-500/20'  },
  { dot: 'bg-emerald-400',text: 'text-emerald-300',bar: 'bg-emerald-400/60',ring: 'ring-emerald-500/20'},
  { dot: 'bg-sky-400',    text: 'text-sky-300',    bar: 'bg-sky-400/60',    ring: 'ring-sky-500/20'    },
  { dot: 'bg-rose-400',   text: 'text-rose-300',   bar: 'bg-rose-400/60',   ring: 'ring-rose-500/20'   },
  { dot: 'bg-indigo-400', text: 'text-indigo-300', bar: 'bg-indigo-400/60', ring: 'ring-indigo-500/20' },
  { dot: 'bg-orange-400', text: 'text-orange-300', bar: 'bg-orange-400/60', ring: 'ring-orange-500/20' },
]

// ── List Column ───────────────────────────────────────────────────────────────

function ListColumn({
  list,
  cards,
  colorIdx,
  draggingId,
  dropTarget,
  selectedTaskId,
  addingToListId,
  activeProjectId,
  projectInfo,
  activePersonId,
  personInfo,
  selectedIds,
  isDraggingThis,
  showInsertBefore,
  isArchive,
  collapsed,
  onToggleCollapse,
  onSetCardColor,
  onToggleSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onCardClick,
  onAddCard,
  onCancelAdd,
  setAddingToList,
  onRename,
  onDelete,
  onMoveToDone,
  onMoveUp,
  onMoveDown,
  onListDragStart,
  onListDragOver,
  onListDrop,
  onListDragEnd,
}: {
  list: List
  cards: Task[]
  colorIdx: number
  draggingId: string | null
  dropTarget: { listId: string; beforeCardId: string | null } | null
  selectedTaskId: string | null
  addingToListId: string | null
  activeProjectId: string | null
  projectInfo: Record<string, { name: string; color: string }>
  activePersonId: string | null
  personInfo: Record<string, { name: string; color: string }>
  selectedIds: Set<string>
  isDraggingThis: boolean
  showInsertBefore: boolean
  isArchive: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onSetCardColor: (taskId: string, key: string) => void
  onToggleSelect: (taskId: string) => void
  onDragStart: (taskId: string) => void
  onDragOver: (e: React.DragEvent, listId: string, beforeCardId: string | null) => void
  onDrop: (e: React.DragEvent, listId: string, beforeCardId: string | null) => void
  onDragEnd: () => void
  onCardClick: (task: Task) => void
  onAddCard: (task: Task) => void
  onCancelAdd: () => void
  setAddingToList: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onMoveToDone?: (cardId: string) => void
  onMoveUp: (cardId: string) => void
  onMoveDown: (cardId: string) => void
  onListDragStart: () => void
  onListDragOver: (e: React.DragEvent) => void
  onListDrop: (e: React.DragEvent) => void
  onListDragEnd: () => void
}) {
  const col = COLUMN_COLORS[colorIdx % COLUMN_COLORS.length]
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal, setTitleVal] = useState(list.title)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select()
  }, [editingTitle])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function commitRename() {
    const t = titleVal.trim()
    if (t && t !== list.title) onRename(list.id, t)
    else setTitleVal(list.title)
    setEditingTitle(false)
  }

  const isDropTarget = dropTarget?.listId === list.id

  // Collapsed archive — a spine you can still drop cards onto to file them away.
  if (isArchive && collapsed) {
    return (
      <div
        className={`relative w-12 shrink-0 self-stretch flex flex-col items-center gap-3 py-3 rounded-2xl border transition-colors panel ${
          isDropTarget
            ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
            : 'border-zinc-200 dark:border-white/[0.07] bg-zinc-50/60 dark:bg-white/[0.02] hover:border-zinc-300 dark:hover:border-white/[0.12]'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          if (e.dataTransfer.types.includes('listdrag')) onListDragOver(e)
          else onDragOver(e, list.id, null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (e.dataTransfer.types.includes('listdrag')) onListDrop(e)
          else onDrop(e, list.id, null)
        }}
      >
        {showInsertBefore && (
          <div className="absolute -left-2.5 top-0 bottom-0 w-1 bg-indigo-500/70 rounded-full z-20 pointer-events-none" />
        )}
        <button
          onClick={onToggleCollapse}
          title="Show done tasks"
          className="p-1 rounded-lg text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ChevronsRight size={14} />
        </button>
        <Archive size={14} className="shrink-0 text-zinc-500 dark:text-zinc-200" />
        <span className="text-[13px] tabular-nums text-zinc-500 dark:text-zinc-200">{cards.length}</span>
        <button
          onClick={onToggleCollapse}
          title="Show done tasks"
          className="flex-1 text-[13px] font-semibold tracking-wide text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors [writing-mode:vertical-rl] truncate"
        >
          {list.title}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`w-64 sm:w-72 shrink-0 flex flex-col max-h-full relative transition-opacity duration-150 ${isDraggingThis ? 'opacity-40' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('listdrag')) return
        e.preventDefault()
        onListDragOver(e)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.types.includes('listdrag')) return
        e.preventDefault()
        onListDrop(e)
      }}
    >
      {/* Column insert indicator */}
      {showInsertBefore && (
        <div className="absolute -left-2.5 top-0 bottom-0 w-1 bg-indigo-500/70 rounded-full z-20 pointer-events-none" />
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between px-1 mb-2.5 gap-2 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          e.dataTransfer.setData('listdrag', list.id)
          e.dataTransfer.effectAllowed = 'move'
          onListDragStart()
        }}
        onDragEnd={onListDragEnd}
      >
        <GripVertical size={12} className="text-zinc-500 dark:text-zinc-200 shrink-0 -ml-1" />
        {editingTitle ? (
          <input
            ref={titleInputRef}
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setTitleVal(list.title)
                setEditingTitle(false)
              }
            }}
            className="flex-1 panel bg-zinc-100 dark:bg-white/[0.07] border border-zinc-200 dark:border-white/[0.12] rounded-lg px-2.5 py-1 text-sm font-semibold text-zinc-900 dark:text-white outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingTitle(true) }}
            className={`flex items-center gap-2 flex-1 text-left text-[13px] font-semibold ${
              isArchive ? 'text-zinc-500 dark:text-zinc-200' : col.text
            } hover:text-zinc-900 dark:hover:text-white transition-colors px-1 py-0.5 rounded-lg truncate`}
          >
            {isArchive
              ? <Archive size={13} className="shrink-0 text-zinc-500 dark:text-zinc-200" />
              : <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
            }
            {list.title}
          </button>
        )}
        <span className="text-[13px] text-zinc-500 dark:text-zinc-200 tabular-nums shrink-0">{cards.length}</span>
        {isArchive && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
            title="Hide done tasks"
            className="shrink-0 p-1 rounded-lg text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
          >
            <ChevronsLeft size={14} />
          </button>
        )}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setShowMenu((s) => !s)}
            className="p-1 rounded-lg text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
          >
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-30 w-40 bg-white dark:bg-[#17171f] border border-zinc-200 dark:border-white/[0.08] rounded-xl shadow-xl overflow-hidden py-1">
              <button
                onClick={() => {
                  setShowMenu(false)
                  setEditingTitle(true)
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] text-zinc-700 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Rename list
              </button>
              <button
                onClick={() => {
                  setShowMenu(false)
                  onDelete(list.id)
                }}
                className="w-full text-left px-3.5 py-2 text-[13px] text-rose-400/80 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
              >
                Delete list
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cards area */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden rounded-2xl min-h-[60px] transition-colors duration-150 ${
          isDropTarget && !dropTarget?.beforeCardId
            ? 'bg-indigo-500/[0.04] ring-1 ring-indigo-500/20'
            : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          onDragOver(e, list.id, null)
        }}
        onDrop={(e) => onDrop(e, list.id, null)}
      >
        <div className="space-y-2 p-1">
          {cards.map((card, idx) => {
            const showPlaceholder =
              draggingId &&
              draggingId !== card.id &&
              dropTarget?.listId === list.id &&
              dropTarget?.beforeCardId === card.id

            return (
              <div key={card.id}>
                {showPlaceholder && (
                  <div className="h-10 rounded-xl bg-indigo-500/10 border-2 border-dashed border-indigo-500/30 mb-2" />
                )}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDragOver(e, list.id, card.id)
                  }}
                  onDrop={(e) => {
                    e.stopPropagation()
                    onDrop(e, list.id, card.id)
                  }}
                >
                  <KanbanCard
                    task={card}
                    // redundant while filtered to a single project/person
                    project={activeProjectId || !card.project_id ? null : projectInfo[card.project_id] ?? null}
                    assignee={activePersonId || !card.assignee_id ? null : personInfo[card.assignee_id] ?? null}
                    isDragging={draggingId === card.id}
                    isSelected={selectedIds.has(card.id)}
                    isArchived={isArchive}
                    onSetColor={(key) => onSetCardColor(card.id, key)}
                    onToggleSelect={() => onToggleSelect(card.id)}
                    onDragStart={() => onDragStart(card.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => onCardClick(card)}
                    onMoveToDone={onMoveToDone ? () => onMoveToDone(card.id) : undefined}
                    onMoveUp={() => onMoveUp(card.id)}
                    onMoveDown={() => onMoveDown(card.id)}
                  />
                </div>
              </div>
            )
          })}

          {/* Placeholder at bottom of list */}
          {draggingId &&
            dropTarget?.listId === list.id &&
            dropTarget?.beforeCardId === null &&
            !cards.find((c) => c.id === draggingId || dropTarget?.beforeCardId === c.id) && (
              <div className="h-10 rounded-xl bg-indigo-500/10 border-2 border-dashed border-indigo-500/30" />
            )}
        </div>

        {/* Add card form */}
        {addingToListId === list.id ? (
          <div className="px-1 pb-1">
            <AddCardForm
              listId={list.id}
              projectId={activeProjectId}
              assigneeId={activePersonId}
              onAdd={(task) => {
                onAddCard(task)
              }}
              onCancel={onCancelAdd}
            />
          </div>
        ) : (
          <button
            onClick={() => setAddingToList(list.id)}
            className="flex items-center gap-2 w-full px-2 py-2 mt-1 rounded-xl text-[13px] text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors"
          >
            <Plus size={13} />
            Add a card
          </button>
        )}
      </div>
    </div>
  )
}

// ── Add List Form ─────────────────────────────────────────────────────────────

function AddListForm({
  onAdd,
  onCancel,
}: {
  onAdd: (list: List) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    startTransition(async () => {
      const list = await createList(t)
      if (list) {
        onAdd(list)
        setTitle('')
        ref.current?.focus()
      }
    })
  }

  return (
    <div className="w-64 sm:w-72 shrink-0 panel bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.07] rounded-2xl p-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          ref={ref}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          placeholder="Enter list title…"
          className="w-full panel bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 outline-none focus:border-indigo-500/40 transition-colors"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!title.trim() || pending}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 transition-colors"
          >
            Add list
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors dark:text-zinc-200"
          >
            <X size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Bulk Edit Bar ─────────────────────────────────────────────────────────────

const BULK_SELECT_CLS =
  'panel bg-zinc-50 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-[13px] text-zinc-700 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-white/[0.2] transition-colors dark:[color-scheme:dark]'

function BulkEditBar({
  count,
  projects,
  people,
  onApply,
  onColor,
  onDelete,
  onClear,
}: {
  count: number
  projects: Project[]
  people: Person[]
  onApply: (updates: Partial<Task>) => void
  onColor: (key: string) => void
  onDelete: () => void
  onClear: () => void
}) {
  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-max max-w-[calc(100vw-1.5rem)]">
      <div className="flex items-center gap-2 flex-wrap justify-center px-3.5 py-2.5 rounded-2xl border border-zinc-200 dark:border-white/[0.1] bg-white/95 dark:bg-[#17171f]/95 backdrop-blur-xl shadow-2xl">
        <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-200 tabular-nums px-1 shrink-0">
          {count} selected
        </span>

        {/* Priority */}
        <CustomSelect
          value=""
          placeholder="Priority…"
          small
          onChange={(v) => v && onApply({ priority: v as Task['priority'] })}
          options={[
            { value: '', label: 'Priority…' },
            ...(['none', 'low', 'medium', 'high'] as const).map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
          ]}
        />

        {/* Project */}
        <CustomSelect
          value=""
          placeholder="Project…"
          small
          onChange={(v) => v && onApply({ project_id: v === '__clear__' ? null : v })}
          options={[
            { value: '', label: 'Project…' },
            { value: '__clear__', label: 'No project' },
            ...projects.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />

        {/* Assignee */}
        <CustomSelect
          value=""
          placeholder="Assign to…"
          small
          onChange={(v) => v && onApply({ assignee_id: v === '__clear__' ? null : v })}
          options={[
            { value: '', label: 'Assign to…' },
            { value: '__clear__', label: 'Unassigned' },
            ...people.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />

        {/* Schedule: one click for today/tomorrow, the picker for any other day */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onApply({ due_date: toDateKey(new Date()) })}
            title="Schedule for today"
            className="px-2 py-1.5 rounded-lg text-[13px] font-medium border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/50 transition-all"
          >
            Today
          </button>
          <button
            onClick={() => {
              const d = new Date()
              d.setDate(d.getDate() + 1)
              onApply({ due_date: toDateKey(d) })
            }}
            title="Schedule for tomorrow"
            className="px-2 py-1.5 rounded-lg text-[13px] font-medium border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all"
          >
            Tomorrow
          </button>
          <input
            type="date"
            value=""
            onChange={(e) => e.target.value && onApply({ due_date: e.target.value })}
            title="Schedule for another day"
            className={`${BULK_SELECT_CLS} min-w-0 [color-scheme:dark]`}
          />
          <button
            onClick={() => onApply({ due_date: null })}
            title="Clear due date"
            className="p-1 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1 px-1">
          {COLOR_SWATCHES.map((s) => (
            <button
              key={s.key}
              onClick={() => onColor(s.key)}
              title={s.key ? `Color ${s.key}` : 'Default color'}
              className={`w-4 h-4 rounded-full ${s.bg} hover:scale-125 transition-transform border border-black/10 dark:border-white/10`}
            />
          ))}
        </div>

        <span className="w-px h-5 panel bg-zinc-200 dark:bg-white/[0.08] shrink-0" />

        <button
          onClick={onDelete}
          title="Delete selected cards"
          className="p-1.5 rounded-lg text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={14} />
        </button>
        <button
          onClick={onClear}
          title="Clear selection"
          className="p-1.5 rounded-lg text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

// ── Main Board ────────────────────────────────────────────────────────────────

export default function KanbanBoard({
  initialLists,
  initialTasks,
  initialProjects,
  initialPeople,
  initialArchiveCollapsed = false,
}: {
  initialLists: List[]
  initialTasks: Task[]
  initialProjects: Project[]
  initialPeople: Person[]
  initialArchiveCollapsed?: boolean
}) {
  const router = useRouter()
  const [lists, setLists] = useState(initialLists)
  const [tasks, setTasks] = useState(initialTasks)
  const [projects, setProjects] = useState(initialProjects)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  // A locally-picked colour wins over the (optional) DB column, but it only
  // exists in this browser — fold it in after mount so the first render still
  // matches the server's.
  const [people, setPeople] = useState<Person[]>(initialPeople)
  useEffect(() => {
    setPeople((prev) => prev.map((p) => ({ ...p, color: getStoredPersonColor(p.id) || p.color })))
  }, [])
  const [activePersonId, setActivePersonId] = useState<string | null>(null)
  const [showPersonPicker, setShowPersonPicker] = useState(false)

  // The Done list is the archive: finished work, out of the way, still reachable.
  const doneList = useMemo(
    () => lists.find((l) => l.title.toLowerCase() === 'done') ?? null,
    [lists]
  )
  // Comes from a cookie the page read on the server, so the column renders in
  // the same state on both sides instead of snapping shut after hydration.
  const [archiveCollapsed, setArchiveCollapsed] = useState(initialArchiveCollapsed)

  // Browsers that collapsed it before the cookie existed keep the choice: hand
  // the old localStorage value over once, then drop the key.
  useEffect(() => {
    const stored = localStorage.getItem(ARCHIVE_COOKIE)
    if (stored === null) return
    localStorage.removeItem(ARCHIVE_COOKIE)
    setPrefCookie(ARCHIVE_COOKIE, stored)
    setArchiveCollapsed(stored === '1')
  }, [])

  function toggleArchive() {
    setArchiveCollapsed((c) => {
      setPrefCookie(ARCHIVE_COOKIE, c ? '0' : '1')
      return !c
    })
  }
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ listId: string; beforeCardId: string | null } | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [addingToList, setAddingToList] = useState<string | null>(null)
  const [addingList, setAddingList] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()

  // Colours picked before the tasks.color migration only exist in this browser —
  // hand them to the DB once, then let the column own them. After mount, so the
  // first render still matches what the server sent.
  useEffect(() => {
    const legacy = legacyCardColors(tasks)
    const ids = Object.keys(legacy)
    if (ids.length === 0) {
      localStorage.setItem(CARD_COLORS_MIGRATED, '1')
      return
    }
    const byColor: Record<string, string[]> = {}
    for (const id of ids) (byColor[legacy[id]] ??= []).push(id)
    startTransition(async () => {
      try {
        await Promise.all(Object.entries(byColor).map(([key, taskIds]) => setTaskColors(taskIds, key)))
        localStorage.setItem(CARD_COLORS_MIGRATED, '1')
        for (const id of ids) storeCardColor(id, '')
      } catch {
        // No `tasks.color` column yet — the keys stay put and we retry next load.
      }
      // Either way the board shows them: from the column now, or from here.
      setTasks((prev) => prev.map((t) => (legacy[t.id] ? { ...t, color: legacy[t.id] } : t)))
    })
    // Once per mount: a later run would find the keys already gone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── List drag state ──────────────────────────────────────────────────────────
  const [draggingListId, setDraggingListId] = useState<string | null>(null)
  const [listDropIdx, setListDropIdx] = useState<number | null>(null)

  const cardsByList = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const l of lists) map[l.id] = []
    for (const t of tasks) {
      if (activeProjectId && t.project_id !== activeProjectId) continue
      if (activePersonId && t.assignee_id !== activePersonId) continue
      if (t.list_id && map[t.list_id]) map[t.list_id].push(t)
    }
    const PRIORITY_ORDER: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2, none: 3 }
    for (const id in map) {
      // Priority is a planning tool — the archive is a log, so it stays in the
      // order things were finished (newest first, see onMoveToDone).
      if (doneList && id === doneList.id) {
        map[id].sort((a, b) => a.position - b.position)
        continue
      }
      map[id].sort((a, b) => {
        const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        return pd !== 0 ? pd : a.position - b.position
      })
    }
    return map
  }, [lists, tasks, activeProjectId, activePersonId, doneList])

  const projectInfo = useMemo(
    () =>
      Object.fromEntries(
        projects.map((p, i) => [p.id, { name: p.name, color: resolveProjectColor(p, i) }])
      ) as Record<string, { name: string; color: string }>,
    [projects]
  )

  // Chip counters only track open work — done cards (flag or Done column) are
  // excluded. With a person selected they count that person's tasks only, so the
  // chips agree with the board underneath them.
  const openTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.done &&
          (!doneList || t.list_id !== doneList.id) &&
          (!activePersonId || t.assignee_id === activePersonId)
      ),
    [tasks, doneList, activePersonId]
  )

  const projectCounts = useMemo(() => {
    const counts: Record<string, number> = { __none__: 0 }
    for (const t of openTasks) counts[t.project_id ?? '__none__'] = (counts[t.project_id ?? '__none__'] ?? 0) + 1
    return counts
  }, [openTasks])

  const personInfo = useMemo(
    () =>
      Object.fromEntries(
        people.map((p, i) => [p.id, { name: p.name, color: resolvePersonColor(p, i) }])
      ) as Record<string, { name: string; color: string }>,
    [people]
  )
  const activePerson = activePersonId ? people.find((p) => p.id === activePersonId) ?? null : null

  function handleDragStart(taskId: string) {
    setDraggingId(taskId)
  }

  function handleDragOver(e: React.DragEvent, listId: string, beforeCardId: string | null) {
    e.preventDefault()
    setDropTarget((prev) => {
      if (prev?.listId === listId && prev?.beforeCardId === beforeCardId) return prev
      return { listId, beforeCardId }
    })
  }

  function handleDrop(e: React.DragEvent, listId: string, beforeCardId: string | null) {
    e.preventDefault()
    if (!draggingId) return
    performMove(draggingId, listId, beforeCardId)
    setDraggingId(null)
    setDropTarget(null)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDropTarget(null)
  }

  function performMove(cardId: string, targetListId: string, beforeCardId: string | null) {
    // Dropped onto itself — nothing to do
    if (beforeCardId === cardId) return

    const listCards = (cardsByList[targetListId] ?? []).filter((c) => c.id !== cardId)
    // -1 covers both "drop at end" and a before-card that's no longer in this list
    const beforeIdx = beforeCardId ? listCards.findIndex((c) => c.id === beforeCardId) : -1

    let newPosition: number
    if (beforeIdx === -1) {
      const last = listCards[listCards.length - 1]
      newPosition = last ? last.position + 1000 : 1000
    } else {
      const before = listCards[beforeIdx]
      const prev = listCards[beforeIdx - 1]
      newPosition = prev ? (prev.position + before.position) / 2 : before.position - 500
    }

    // Landing in (or leaving) the Done list keeps the done flag in sync, so
    // counts elsewhere (e.g. the dashboard's open-task tile) stay honest.
    const done = doneList ? targetListId === doneList.id : undefined

    setTasks((prev) =>
      prev.map((t) =>
        t.id === cardId
          ? { ...t, list_id: targetListId, position: newPosition, ...(done === undefined ? {} : { done }) }
          : t
      )
    )

    startTransition(async () => {
      await reorderCards([{ id: cardId, list_id: targetListId, position: newPosition, done }])
    })
  }

  function handleMoveUp(cardId: string, listId: string) {
    const cards = cardsByList[listId] ?? []
    const idx = cards.findIndex((c) => c.id === cardId)
    if (idx <= 0) return
    performMove(cardId, listId, cards[idx - 1].id)
  }

  function handleMoveDown(cardId: string, listId: string) {
    const cards = cardsByList[listId] ?? []
    const idx = cards.findIndex((c) => c.id === cardId)
    if (idx < 0 || idx >= cards.length - 1) return
    const afterNext = cards[idx + 2]
    performMove(cardId, listId, afterNext?.id ?? null)
  }

  function handleRenameList(id: string, title: string) {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, title } : l)))
    startTransition(async () => {
      await renameList(id, title)
    })
  }

  function handleListDragStart(listId: string) {
    setDraggingListId(listId)
  }

  function handleListDragOver(e: React.DragEvent, listIdx: number) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dropIdx = e.clientX < rect.left + rect.width / 2 ? listIdx : listIdx + 1
    setListDropIdx(dropIdx)
  }

  function handleListDrop(listIdx: number) {
    if (draggingListId === null || listDropIdx === null) return
    const fromIdx = lists.findIndex((l) => l.id === draggingListId)
    if (fromIdx === -1) return

    const newLists = [...lists]
    const [removed] = newLists.splice(fromIdx, 1)
    const insertIdx = Math.max(0, Math.min(listDropIdx > fromIdx ? listDropIdx - 1 : listDropIdx, newLists.length))
    newLists.splice(insertIdx, 0, removed)

    const updates = newLists.map((l, i) => ({ id: l.id, position: (i + 1) * 1000 }))
    setLists(newLists.map((l, i) => ({ ...l, position: (i + 1) * 1000 })))
    setDraggingListId(null)
    setListDropIdx(null)

    startTransition(async () => {
      await reorderLists(updates)
    })
  }

  function handleListDragEnd() {
    setDraggingListId(null)
    setListDropIdx(null)
  }

  function handleDeleteList(id: string) {
    setLists((prev) => prev.filter((l) => l.id !== id))
    const removed = tasks.filter((t) => t.list_id === id).map((t) => t.id)
    setTasks((prev) => prev.filter((t) => t.list_id !== id))
    setSelectedIds((prev) => {
      if (!removed.some((r) => prev.has(r))) return prev
      const next = new Set(prev)
      for (const r of removed) next.delete(r)
      return next
    })
    startTransition(async () => {
      await deleteList(id)
      router.refresh()
    })
  }

  // ── Projects ─────────────────────────────────────────────────────────────────

  function handleCreateProject(name: string, color: string) {
    startTransition(async () => {
      try {
        const project = await createProject(name, color)
        if (project) setProjects((prev) => [...prev, project])
      } catch (err) {
        // Most likely cause: supabase-projects-schema.sql hasn't been run yet
        alert(`Could not create project: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    })
  }

  function handleRenameProject(id: string, name: string) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
    startTransition(async () => {
      await renameProject(id, name)
    })
  }

  function handleSetProjectColor(id: string, color: string) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)))
    startTransition(async () => {
      await setProjectColor(id, color)
    })
  }

  // Tasks outlive their project — they just fall back to unfiled.
  function handleDeleteProject(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    setTasks((prev) => prev.map((t) => (t.project_id === id ? { ...t, project_id: null } : t)))
    if (activeProjectId === id) setActiveProjectId(null)
    startTransition(async () => {
      await deleteProject(id)
      router.refresh()
    })
  }

  function handleAssignProject(taskId: string, projectId: string | null) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, project_id: projectId } : t)))
    if (selectedTask?.id === taskId) setSelectedTask((s) => (s ? { ...s, project_id: projectId } : s))
    if (projectId) autoColorForProject([taskId], projectId)
    startTransition(async () => {
      await setTaskProject(taskId, projectId)
    })
  }

  // ── Card colours / selection ─────────────────────────────────────────────────

  // The colour is a column on the task, so it travels with the card. Falls back
  // to this browser only if the tasks.color migration hasn't been run.
  function applyCardColor(taskIds: string[], key: string) {
    if (taskIds.length === 0) return
    const ids = new Set(taskIds)
    setTasks((prev) => prev.map((t) => (ids.has(t.id) ? { ...t, color: key } : t)))
    setSelectedTask((s) => (s && ids.has(s.id) ? { ...s, color: key } : s))
    startTransition(async () => {
      try {
        await setTaskColors(taskIds, key)
        for (const id of taskIds) storeCardColor(id, '')
      } catch {
        for (const id of taskIds) storeCardColor(id, key)
      }
    })
  }

  function handleSetCardColor(taskId: string, key: string) {
    applyCardColor([taskId], key)
  }

  // Cards pick up their project's tint when they join one ('grey' has no card
  // equivalent, so grey projects leave card colours alone).
  function autoColorForProject(taskIds: string[], projectId: string) {
    const key = projectInfo[projectId]?.color
    if (!key || key === 'grey') return
    applyCardColor(taskIds, key)
  }

  function handleToggleSelect(taskId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function handleAddCard(task: Task) {
    // Cards created straight into the Done column count as done
    const bornDone = !!doneList && task.list_id === doneList.id && !task.done
    if (bornDone) task = { ...task, done: true }
    setTasks((prev) => [...prev, task])
    if (task.project_id) autoColorForProject([task.id], task.project_id)
    if (bornDone) {
      startTransition(async () => {
        await updateTask(task.id, { done: true })
      })
    }
  }

  // ── Bulk edits ───────────────────────────────────────────────────────────────

  function handleBulkApply(updates: Partial<Task>) {
    const ids = Array.from(selectedIds)
    setTasks((prev) => prev.map((t) => (selectedIds.has(t.id) ? { ...t, ...updates } : t)))
    if (selectedTask && selectedIds.has(selectedTask.id)) {
      setSelectedTask((s) => (s ? { ...s, ...updates } : s))
    }
    if (updates.project_id) autoColorForProject(ids, updates.project_id)
    startTransition(async () => {
      await updateTasks(ids, updates)
    })
  }

  function handleBulkColor(key: string) {
    applyCardColor(Array.from(selectedIds), key)
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    if (!confirm(`Delete ${ids.length} card${ids.length === 1 ? '' : 's'}?`)) return
    setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)))
    if (selectedTask && selectedIds.has(selectedTask.id)) setSelectedTask(null)
    setSelectedIds(new Set())
    startTransition(async () => {
      await deleteTasks(ids)
    })
  }

  // ── People ───────────────────────────────────────────────────────────────────

  function handleCreatePerson(name: string) {
    startTransition(async () => {
      try {
        const person = await createPerson(name)
        if (person) setPeople((prev) => [...prev, person])
      } catch (err) {
        // Most likely cause: supabase-people-schema.sql hasn't been run yet
        alert(`Could not add person: ${err instanceof Error ? err.message : 'unknown error'}`)
      }
    })
  }

  function handleSetPersonColor(id: string, color: string) {
    storePersonColor(id, color)
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)))
    startTransition(async () => {
      try {
        await setPersonColor(id, color)
      } catch {
        // No `people.color` column yet — localStorage already has the choice.
      }
    })
  }

  // Tasks outlive their assignee — they just fall back to unassigned.
  function handleDeletePerson(id: string) {
    setPeople((prev) => prev.filter((p) => p.id !== id))
    setTasks((prev) => prev.map((t) => (t.assignee_id === id ? { ...t, assignee_id: null } : t)))
    if (activePersonId === id) setActivePersonId(null)
    startTransition(async () => {
      await deletePerson(id)
      router.refresh()
    })
  }

  function handleCardUpdate(taskId: string, updates: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)))
    if (selectedTask?.id === taskId) setSelectedTask((s) => (s ? { ...s, ...updates } : s))
    if (updates.project_id) autoColorForProject([taskId], updates.project_id)
  }

  function handleCardDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setSelectedIds((prev) => {
      if (!prev.has(taskId)) return prev
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
    setSelectedTask(null)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Page header — title reacts to the selected person */}
      <div className="flex items-end justify-between gap-3 px-4 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 shrink-0">
        <div className="min-w-0">
          <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
            Productivity
          </p>
          <h1 className="text-2xl sm:text-[26px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight truncate">
            {activePerson ? `${activePerson.name}'s Tasks` : 'Tasks'}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0 pb-0.5">
          {activePerson ? (
            <>
              <button
                onClick={() => setShowPersonPicker(true)}
                title="Switch person"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
              >
                <ArrowLeftRight size={13} />
                Switch
              </button>
              <button
                onClick={() => setActivePersonId(null)}
                title="Back to all tasks"
                className="p-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowPersonPicker(true)}
              title="Filter by person"
              className="p-2 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <UserRound size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Projects */}
      <ProjectBar
        projects={projects}
        activeId={activeProjectId}
        total={openTasks.length}
        countFor={(id) => projectCounts[id ?? '__none__'] ?? 0}
        draggingCard={draggingId !== null}
        onSelect={setActiveProjectId}
        onCreate={handleCreateProject}
        onRename={handleRenameProject}
        onDelete={handleDeleteProject}
        onSetColor={handleSetProjectColor}
        onDropCard={(projectId) => {
          if (!draggingId) return
          handleAssignProject(draggingId, projectId)
          setDraggingId(null)
          setDropTarget(null)
        }}
      />

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 sm:gap-4 h-full px-3 sm:px-6 py-4 sm:py-6 items-start min-w-max">
          {lists.map((list, idx) => (
            <ListColumn
              key={list.id}
              list={list}
              colorIdx={idx}
              cards={cardsByList[list.id] ?? []}
              draggingId={draggingId}
              dropTarget={dropTarget}
              selectedTaskId={selectedTask?.id ?? null}
              addingToListId={addingToList}
              activeProjectId={activeProjectId}
              projectInfo={projectInfo}
              activePersonId={activePersonId}
              personInfo={personInfo}
              selectedIds={selectedIds}
              isDraggingThis={draggingListId === list.id}
              showInsertBefore={listDropIdx === idx}
              isArchive={doneList?.id === list.id}
              collapsed={archiveCollapsed}
              onToggleCollapse={toggleArchive}
              onSetCardColor={handleSetCardColor}
              onToggleSelect={handleToggleSelect}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onCardClick={(task) => {
                setAddingToList(null)
                setSelectedTask(task)
              }}
              onAddCard={handleAddCard}
              onCancelAdd={() => setAddingToList(null)}
              setAddingToList={(id) => {
                setSelectedTask(null)
                setAddingToList(id)
              }}
              onRename={handleRenameList}
              onDelete={handleDeleteList}
              onMoveToDone={
                doneList && list.id !== doneList.id
                  // Newest completion sits at the top of the archive
                  ? (cardId) => performMove(cardId, doneList.id, cardsByList[doneList.id]?.[0]?.id ?? null)
                  : undefined
              }
              onMoveUp={(cardId) => handleMoveUp(cardId, list.id)}
              onMoveDown={(cardId) => handleMoveDown(cardId, list.id)}
              onListDragStart={() => handleListDragStart(list.id)}
              onListDragOver={(e) => handleListDragOver(e, idx)}
              onListDrop={() => handleListDrop(idx)}
              onListDragEnd={handleListDragEnd}
            />
          ))}

          {/* Insert-after-last indicator */}
          {listDropIdx === lists.length && (
            <div className="w-1 shrink-0 self-stretch bg-indigo-500/70 rounded-full" />
          )}

          {/* Add list */}
          {addingList ? (
            <AddListForm
              onAdd={(list) => {
                setLists((prev) => [...prev, list])
                setAddingList(false)
              }}
              onCancel={() => setAddingList(false)}
            />
          ) : (
            <button
              onClick={() => setAddingList(true)}
              className="panel w-64 sm:w-72 shrink-0 flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-white/[0.14] hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-all text-[13px]"
            >
              <Plus size={14} />
              Add another list
            </button>
          )}
        </div>
      </div>

      {/* Card Modal */}
      {selectedTask && (
        <CardModal
          task={selectedTask}
          projects={projects}
          people={people}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => handleCardUpdate(selectedTask.id, updates)}
          onDelete={() => handleCardDelete(selectedTask.id)}
        />
      )}

      {/* Person Picker */}
      {showPersonPicker && (
        <PersonPickerModal
          people={people}
          activePersonId={activePersonId}
          onSelect={setActivePersonId}
          onCreate={handleCreatePerson}
          onDelete={handleDeletePerson}
          onSetColor={handleSetPersonColor}
          onClose={() => setShowPersonPicker(false)}
        />
      )}

      {/* Bulk Edit Bar */}
      {selectedIds.size > 0 && (
        <BulkEditBar
          count={selectedIds.size}
          projects={projects}
          people={people}
          onApply={handleBulkApply}
          onColor={handleBulkColor}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  )
}
