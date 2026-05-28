'use client'

import { useState, useTransition, useRef } from 'react'
import { createTask, updateTask, deleteTask } from '@/lib/actions'
import { X, Circle, CheckCircle2 } from 'lucide-react'
import type { Task } from '@/lib/supabase'

const PRIORITY_CYCLE: Task['priority'][] = ['none', 'low', 'medium', 'high']

const PRIORITY_COLOR: Record<Task['priority'], string> = {
  none: 'bg-zinc-400 dark:bg-zinc-700',
  low: 'bg-sky-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
}

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  none: '',
  low: 'Low',
  medium: 'Med',
  high: 'High',
}

type Filter = 'all' | 'active' | 'done'

function isOverdue(due: string | null) {
  if (!due) return false
  return new Date(due) < new Date(new Date().toDateString())
}

function formatDue(due: string | null) {
  if (!due) return null
  const d = new Date(due + 'T00:00:00')
  const today = new Date(new Date().toDateString())
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  if (diff <= 7) return `${diff}d`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function TasksView({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial)
  const [filter, setFilter] = useState<Filter>('active')
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<Task['priority']>('none')
  const [newDue, setNewDue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const active = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  const visible = filter === 'all' ? tasks : filter === 'active' ? active : done

  const sortedVisible = [...visible].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const p = { high: 3, medium: 2, low: 1, none: 0 }
    return p[b.priority] - p[a.priority]
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    const optimistic: Task = {
      id: crypto.randomUUID(),
      title,
      description: '',
      done: false,
      priority: newPriority,
      due_date: newDue || null,
      list_id: null,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setTasks((prev) => [...prev, optimistic])
    setNewTitle('')
    setNewDue('')
    setNewPriority('none')
    inputRef.current?.focus()
    startTransition(async () => {
      const created = await createTask(title, newPriority, newDue || null)
      if (created) {
        setTasks((prev) => prev.map((t) => (t.id === optimistic.id ? created : t)))
      }
    })
  }

  function handleToggle(id: string, done: boolean) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)))
    startTransition(async () => { await updateTask(id, { done }) })
  }

  function handleCyclePriority(id: string, current: Task['priority']) {
    const next = PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(current) + 1) % PRIORITY_CYCLE.length]
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, priority: next } : t)))
    startTransition(async () => { await updateTask(id, { priority: next }) })
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    startTransition(async () => { await deleteTask(id) })
  }

  function startEdit(task: Task) {
    setEditingId(task.id)
    setEditTitle(task.title)
  }

  function commitEdit(id: string) {
    const title = editTitle.trim()
    if (!title) { setEditingId(null); return }
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)))
    setEditingId(null)
    startTransition(async () => { await updateTask(id, { title }) })
  }

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: 'active', label: 'Active', count: active.length },
    { key: 'done', label: 'Done', count: done.length },
    { key: 'all', label: 'All', count: tasks.length },
  ]

  return (
    <div>
      {/* Add task form */}
      <form onSubmit={handleAdd} className="mb-8">
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-white/[0.03]">
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-zinc-200 dark:via-white/[0.12] to-transparent" />
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Priority picker */}
            <button
              type="button"
              onClick={() => setNewPriority(PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(newPriority) + 1) % PRIORITY_CYCLE.length])}
              title={`Priority: ${newPriority}`}
              className="shrink-0 flex items-center gap-1.5 group"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLOR[newPriority]}`} />
              {newPriority !== 'none' && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400 transition-colors">
                  {PRIORITY_LABEL[newPriority]}
                </span>
              )}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add a task…"
              className="flex-1 bg-transparent text-sm text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-700 outline-none"
            />

            {/* Due date */}
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="bg-transparent text-[11px] text-zinc-400 dark:text-zinc-600 outline-none cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors [color-scheme:dark]"
            />

            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="shrink-0 px-3 py-1 rounded-lg text-[11px] font-medium border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/[0.08] hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 transition-all"
            >
              Add
            </button>
          </div>
        </div>
      </form>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === tab.key
                ? 'bg-zinc-100 dark:bg-white/[0.07] text-zinc-800 dark:text-zinc-200'
                : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
            <span className={`tabular-nums ${filter === tab.key ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-400 dark:text-zinc-700'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Task list */}
      {sortedVisible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
          <p className="text-sm text-zinc-400 dark:text-zinc-600">
            {filter === 'active' ? 'No active tasks — nice!' : filter === 'done' ? 'Nothing done yet' : 'No tasks yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-px">
          {sortedVisible.map((task) => (
            <div
              key={task.id}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${task.done ? 'opacity-50' : ''}`}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(task.id, !task.done)}
                className="shrink-0 text-zinc-400 dark:text-zinc-600 hover:text-indigo-400 transition-colors"
              >
                {task.done
                  ? <CheckCircle2 size={16} className="text-indigo-400/70" />
                  : <Circle size={16} />
                }
              </button>

              {/* Priority dot */}
              <button
                onClick={() => handleCyclePriority(task.id, task.priority)}
                title={`Priority: ${task.priority} — click to change`}
                className="shrink-0"
              >
                <span className={`block w-2 h-2 rounded-full ${PRIORITY_COLOR[task.priority]} hover:scale-125 transition-transform`} />
              </button>

              {/* Title */}
              {editingId === task.id ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => commitEdit(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(task.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 outline-none"
                />
              ) : (
                <span
                  onDoubleClick={() => !task.done && startEdit(task)}
                  className={`flex-1 text-sm cursor-default select-none ${task.done ? 'line-through text-zinc-400 dark:text-zinc-600' : 'text-zinc-700 dark:text-zinc-300'}`}
                >
                  {task.title}
                </span>
              )}

              {/* Due date */}
              {task.due_date && (
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                  isOverdue(task.due_date) && !task.done
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-zinc-100 dark:bg-white/[0.05] text-zinc-400 dark:text-zinc-600'
                }`}>
                  {formatDue(task.due_date)}
                </span>
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(task.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-zinc-400 dark:text-zinc-700 hover:text-red-400 transition-all"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
