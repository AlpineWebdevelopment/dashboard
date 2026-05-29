'use client'

import { useTransition, useState, useMemo, useRef, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { List, Task } from '@/lib/supabase'
import {
  createList,
  renameList,
  deleteList,
  createTask,
  updateTask,
  deleteTask,
  reorderCards,
} from '@/lib/actions'
import { Plus, X, MoreHorizontal, Trash2, Calendar, Flag, Loader2, Check } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  none: 'bg-zinc-700/60',
  low: 'bg-sky-500/70',
  medium: 'bg-amber-500/70',
  high: 'bg-rose-500/80',
}

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  none: 'No priority',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

function priorityNext(p: Task['priority']): Task['priority'] {
  const order: Task['priority'][] = ['none', 'low', 'medium', 'high']
  return order[(order.indexOf(p) + 1) % order.length]
}

function formatDate(d: string | null) {
  if (!d) return null
  const date = new Date(d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isOverdue(d: string | null) {
  if (!d) return false
  return new Date(d) < new Date(new Date().toDateString())
}

// ── Card Modal ────────────────────────────────────────────────────────────────

function CardModal({
  task,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: Task
  onClose: () => void
  onUpdate: (updates: Partial<Task>) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description ?? '')
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
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
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#111118] border border-zinc-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        <div className={`h-1 w-full ${PRIORITY_COLORS[priority]}`} />

        <div className="p-6 space-y-5">
          {/* Title row + save indicator + close */}
          <div className="flex items-start gap-3">
            <input
              className="flex-1 bg-transparent text-xl font-semibold text-zinc-900 dark:text-zinc-100 outline-none placeholder-zinc-400 dark:placeholder-zinc-600"
              value={title}
              onChange={(e) => { setTitle(e.target.value); triggerSave({ title: e.target.value }) }}
              placeholder="Card title"
            />
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <span className="flex items-center gap-1 text-[11px] h-4">
                {saveStatus === 'saving' && <Loader2 size={10} className="animate-spin text-zinc-400 dark:text-zinc-600" />}
                {saveStatus === 'saved'  && <Check size={10} className="text-emerald-500" />}
              </span>
              <button onClick={onClose} className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">Description</p>
            <textarea
              ref={descRef}
              className="w-full min-h-[80px] bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-zinc-400 dark:focus:border-white/[0.15] resize-none transition-colors"
              value={desc}
              placeholder="Add a description…"
              onChange={(e) => { setDesc(e.target.value); autoResize(e.target); triggerSave({ desc: e.target.value }) }}
              onFocus={(e) => autoResize(e.target)}
            />
          </div>

          {/* Priority + Due date */}
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">Priority</p>
              <button
                onClick={() => { const next = priorityNext(priority); setPriority(next); triggerSave({ priority: next }) }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors w-full"
              >
                <span className={`w-2 h-2 rounded-full ${priority === 'none' ? 'bg-zinc-400 dark:bg-zinc-600' : priority === 'low' ? 'bg-sky-400' : priority === 'medium' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                {PRIORITY_LABELS[priority]}
              </button>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2">Due date</p>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); triggerSave({ dueDate: e.target.value }) }}
                className="w-full bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.07] rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 outline-none focus:border-zinc-400 dark:focus:border-white/[0.15] transition-colors [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Delete only — no Save/Cancel */}
          <div className="pt-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
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

// ── Add Card Form ─────────────────────────────────────────────────────────────

function AddCardForm({
  listId,
  onAdd,
  onCancel,
}: {
  listId: string
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
      const task = await createTask(t, 'none', null, listId, Date.now())
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
        className="w-full bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.1] rounded-xl px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-indigo-500/40 resize-none transition-colors"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add card
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </form>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  onMoveToDone,
}: {
  task: Task
  isDragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onClick: () => void
  onMoveToDone?: () => void
}) {
  const overdue = isOverdue(task.due_date)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group relative rounded-xl border bg-white dark:bg-[#13131e] cursor-grab active:cursor-grabbing transition-all duration-150 overflow-hidden select-none ${
        isDragging
          ? 'opacity-40 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
          : 'border-zinc-200 dark:border-white/[0.07] hover:border-zinc-300 dark:hover:border-white/[0.14] hover:bg-zinc-50 dark:hover:bg-[#16161f] shadow-sm'
      }`}
    >
      {/* Priority strip */}
      {task.priority !== 'none' && (
        <div className={`h-1 w-full ${PRIORITY_COLORS[task.priority]}`} />
      )}

      <div className="px-3.5 py-3">
        <p className="text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors leading-snug">
          {task.title}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          {task.due_date && (
            <span
              className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                overdue
                  ? 'bg-rose-500/15 text-rose-400'
                  : 'bg-zinc-100 dark:bg-white/[0.05] text-zinc-500'
              }`}
            >
              <Calendar size={9} />
              {formatDate(task.due_date)}
            </span>
          )}
          {task.priority !== 'none' && (
            <span
              className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                task.priority === 'high'
                  ? 'bg-rose-500/15 text-rose-400'
                  : task.priority === 'medium'
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-sky-500/15 text-sky-400'
              }`}
            >
              <Flag size={9} />
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {onMoveToDone && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveToDone() }}
              className="ml-auto flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-emerald-500/30 text-emerald-400/70 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/50 transition-all"
            >
              <Check size={9} />
              Done
            </button>
          )}
        </div>
      </div>
    </div>
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
}: {
  list: List
  cards: Task[]
  colorIdx: number
  draggingId: string | null
  dropTarget: { listId: string; beforeCardId: string | null } | null
  selectedTaskId: string | null
  addingToListId: string | null
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

  return (
    <div className="w-64 sm:w-72 shrink-0 flex flex-col max-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-2.5 gap-2">
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
            className="flex-1 bg-zinc-100 dark:bg-white/[0.07] border border-zinc-200 dark:border-white/[0.12] rounded-lg px-2.5 py-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className={`flex items-center gap-2 flex-1 text-left text-[13px] font-semibold ${col.text} hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-1 py-0.5 rounded-lg truncate`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${col.dot}`} />
            {list.title}
          </button>
        )}
        <span className="text-[11px] text-zinc-400 dark:text-zinc-600 tabular-nums shrink-0">{cards.length}</span>
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setShowMenu((s) => !s)}
            className="p-1 rounded-lg text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
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
                className="w-full text-left px-3.5 py-2 text-[13px] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
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
          {cards.map((card) => {
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
                    isDragging={draggingId === card.id}
                    onDragStart={() => onDragStart(card.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => onCardClick(card)}
                    onMoveToDone={onMoveToDone ? () => onMoveToDone(card.id) : undefined}
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
              onAdd={(task) => {
                onAddCard(task)
              }}
              onCancel={onCancelAdd}
            />
          </div>
        ) : (
          <button
            onClick={() => setAddingToList(list.id)}
            className="flex items-center gap-2 w-full px-2 py-2 mt-1 rounded-xl text-[12px] text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors"
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
    <div className="w-64 sm:w-72 shrink-0 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.07] rounded-2xl p-3">
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          ref={ref}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          placeholder="Enter list title…"
          className="w-full bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none focus:border-indigo-500/40 transition-colors"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!title.trim() || pending}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 transition-colors"
          >
            Add list
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main Board ────────────────────────────────────────────────────────────────

export default function KanbanBoard({
  initialLists,
  initialTasks,
}: {
  initialLists: List[]
  initialTasks: Task[]
}) {
  const router = useRouter()
  const [lists, setLists] = useState(initialLists)
  const [tasks, setTasks] = useState(initialTasks)

  const doneList = useMemo(
    () => lists.find((l) => l.title.toLowerCase() === 'done') ?? null,
    [lists]
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ listId: string; beforeCardId: string | null } | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [addingToList, setAddingToList] = useState<string | null>(null)
  const [addingList, setAddingList] = useState(false)
  const [, startTransition] = useTransition()

  const cardsByList = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const l of lists) map[l.id] = []
    for (const t of tasks) {
      if (t.list_id && map[t.list_id]) map[t.list_id].push(t)
    }
    const PRIORITY_ORDER: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2, none: 3 }
    for (const id in map) map[id].sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      return pd !== 0 ? pd : a.position - b.position
    })
    return map
  }, [lists, tasks])

  function handleDragStart(taskId: string) {
    setDraggingId(taskId)
  }

  function handleDragOver(e: React.DragEvent, listId: string, beforeCardId: string | null) {
    e.preventDefault()
    setDropTarget({ listId, beforeCardId })
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
    const listCards = (cardsByList[targetListId] ?? []).filter((c) => c.id !== cardId)

    let newPosition: number
    if (beforeCardId === null) {
      // drop at end
      const last = listCards[listCards.length - 1]
      newPosition = last ? last.position + 1000 : 1000
    } else {
      const beforeIdx = listCards.findIndex((c) => c.id === beforeCardId)
      const before = listCards[beforeIdx]
      const prev = listCards[beforeIdx - 1]
      if (prev) {
        newPosition = (prev.position + before.position) / 2
      } else {
        newPosition = before.position - 500
      }
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === cardId ? { ...t, list_id: targetListId, position: newPosition } : t
      )
    )

    startTransition(async () => {
      await reorderCards([{ id: cardId, list_id: targetListId, position: newPosition }])
    })
  }

  function handleRenameList(id: string, title: string) {
    setLists((prev) => prev.map((l) => (l.id === id ? { ...l, title } : l)))
    startTransition(async () => {
      await renameList(id, title)
    })
  }

  function handleDeleteList(id: string) {
    setLists((prev) => prev.filter((l) => l.id !== id))
    setTasks((prev) => prev.filter((t) => t.list_id !== id))
    startTransition(async () => {
      await deleteList(id)
      router.refresh()
    })
  }

  function handleCardUpdate(taskId: string, updates: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)))
    if (selectedTask?.id === taskId) setSelectedTask((s) => (s ? { ...s, ...updates } : s))
  }

  function handleCardDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setSelectedTask(null)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
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
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onCardClick={(task) => {
                setAddingToList(null)
                setSelectedTask(task)
              }}
              onAddCard={(task) => {
                setTasks((prev) => [...prev, task])
              }}
              onCancelAdd={() => setAddingToList(null)}
              setAddingToList={(id) => {
                setSelectedTask(null)
                setAddingToList(id)
              }}
              onRename={handleRenameList}
              onDelete={handleDeleteList}
              onMoveToDone={
                doneList && list.id !== doneList.id
                  ? (cardId) => performMove(cardId, doneList.id, null)
                  : undefined
              }
            />
          ))}

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
              className="w-64 sm:w-72 shrink-0 flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-zinc-200 dark:border-white/[0.08] text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400 hover:border-zinc-300 dark:hover:border-white/[0.14] hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-all text-[13px]"
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
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => handleCardUpdate(selectedTask.id, updates)}
          onDelete={() => handleCardDelete(selectedTask.id)}
        />
      )}
    </div>
  )
}
