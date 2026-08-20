'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { ChevronDown, ChevronUp, Folder, FolderOpen, Layers, Plus, Trash2, X } from 'lucide-react'
import type { Project } from '@/lib/supabase'

type ProjectColor = {
  label: string
  icon: string
  bg: string
  border: string
  dropBorder: string
  swatch: string
}

// Colour labels — same vocabulary as the card colour picker on the board.
export const PROJECT_COLORS: Record<string, ProjectColor> = {
  grey:   { label: 'Grey',   icon: 'text-zinc-500 dark:text-zinc-200', bg: 'bg-zinc-500/[0.08]',    border: 'border-zinc-400/40',    dropBorder: 'border-zinc-400/70',    swatch: 'bg-zinc-300 dark:bg-zinc-600' },
  red:    { label: 'Red',    icon: 'text-rose-400',                    bg: 'bg-rose-500/[0.08]',    border: 'border-rose-400/40',    dropBorder: 'border-rose-400/70',    swatch: 'bg-rose-400'    },
  orange: { label: 'Orange', icon: 'text-orange-400',                  bg: 'bg-orange-500/[0.08]',  border: 'border-orange-400/40',  dropBorder: 'border-orange-400/70',  swatch: 'bg-orange-400'  },
  yellow: { label: 'Yellow', icon: 'text-amber-400',                   bg: 'bg-amber-500/[0.08]',   border: 'border-amber-400/40',   dropBorder: 'border-amber-400/70',   swatch: 'bg-amber-400'   },
  green:  { label: 'Green',  icon: 'text-emerald-400',                 bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-400/40', dropBorder: 'border-emerald-400/70', swatch: 'bg-emerald-400' },
  blue:   { label: 'Blue',   icon: 'text-sky-400',                     bg: 'bg-sky-500/[0.08]',     border: 'border-sky-400/40',     dropBorder: 'border-sky-400/70',     swatch: 'bg-sky-400'     },
  purple: { label: 'Purple', icon: 'text-violet-400',                  bg: 'bg-violet-500/[0.08]',  border: 'border-violet-400/40',  dropBorder: 'border-violet-400/70',  swatch: 'bg-violet-400'  },
  pink:   { label: 'Pink',   icon: 'text-pink-400',                    bg: 'bg-pink-500/[0.08]',    border: 'border-pink-400/40',    dropBorder: 'border-pink-400/70',    swatch: 'bg-pink-400'    },
}

// Order shown in the picker, and the rotation new projects are seeded from.
export const PROJECT_COLOR_KEYS = ['purple', 'blue', 'green', 'yellow', 'orange', 'red', 'pink', 'grey']

// Projects predating the colour column (and any left unset) fall back to a tint
// picked from their position, so the bar never turns into a wall of grey.
export function resolveProjectColor(project: Project, index: number): string {
  if (project.color && PROJECT_COLORS[project.color]) return project.color
  return PROJECT_COLOR_KEYS[index % (PROJECT_COLOR_KEYS.length - 1)]
}

export function nextProjectColor(projectCount: number): string {
  return PROJECT_COLOR_KEYS[projectCount % (PROJECT_COLOR_KEYS.length - 1)]
}

const CHIP_BASE =
  'panel flex items-center gap-2.5 w-[190px] px-3.5 py-2.5 rounded-xl border text-left transition-all duration-150'

const CHIP_IDLE =
  'border-zinc-200 dark:border-white/[0.06] bg-zinc-50/60 dark:bg-white/[0.02] group-hover/chip:bg-zinc-100 dark:group-hover/chip:bg-white/[0.05] group-hover/chip:border-zinc-300 dark:group-hover/chip:border-white/[0.1]'

// `undefined` = nothing hovered, `null` = the "All tasks" chip.
type DropTarget = string | null | undefined

/**
 * How many project chips a phone shows before the rest fold away.
 *
 * On a phone the bar was three rows of chips before a single card came into
 * view. Two plus "All tasks" is enough to switch between what you are actually
 * working on; the rest are one tap away. Desktop is unaffected — the folding is
 * done with `sm:` classes, so the wide layout never loses a chip.
 */
const MOBILE_CHIPS = 2

export default function ProjectBar({
  projects,
  activeId,
  total,
  countFor,
  draggingCard,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onSetColor,
  onDropCard,
}: {
  projects: Project[]
  activeId: string | null
  total: number
  countFor: (projectId: string | null) => number
  draggingCard: boolean
  onSelect: (id: string | null) => void
  onCreate: (name: string, color: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSetColor: (id: string, color: string) => void
  onDropCard: (projectId: string | null) => void
}) {
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [pickerId, setPickerId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget>(undefined)
  const addRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (adding) addRef.current?.focus() }, [adding])
  useEffect(() => { if (editingId) editRef.current?.select() }, [editingId])

  useEffect(() => {
    if (!pickerId) return
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerId])

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    onCreate(name, nextProjectColor(projects.length))
    setNewName('')
    setAdding(false)
  }

  function commitRename(project: Project) {
    const name = editName.trim()
    if (name && name !== project.name) onRename(project.id, name)
    setEditingId(null)
  }

  // Card drags carry no dataTransfer payload — list drags flag themselves with 'listdrag'.
  function isCardDrag(e: React.DragEvent) {
    return draggingCard && !e.dataTransfer.types.includes('listdrag')
  }

  function dropProps(projectId: string | null) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!isCardDrag(e)) return
        e.preventDefault()
        e.stopPropagation()
        setDropTarget(projectId)
      },
      onDragLeave: () => setDropTarget((prev) => (prev === projectId ? undefined : prev)),
      onDrop: (e: React.DragEvent) => {
        if (!isCardDrag(e)) return
        e.preventDefault()
        e.stopPropagation()
        setDropTarget(undefined)
        onDropCard(projectId)
      },
    }
  }

  // Only worth folding when there is something to fold.
  const collapsible = projects.length > MOBILE_CHIPS
  const collapsed = collapsible && !expanded
  // The chip you are filtered by stays put wherever it sits in the order —
  // hiding the active filter would leave the board narrowed with nothing on
  // screen saying why.
  const foldedAway = collapsed
    ? projects.filter((p, i) => i >= MOBILE_CHIPS && p.id !== activeId).length
    : 0
  /** Hidden on a phone, always shown from `sm` up. */
  const foldClass = 'hidden sm:block'

  return (
    <div className="shrink-0 px-3 sm:px-6 pt-4 sm:pt-5">
      <div className="flex items-center gap-2.5 mb-2.5">
        <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
          Projects
        </p>
        {draggingCard && (
          <span className="text-[12px] text-indigo-400/80">Drop a card on a project to file it</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {/* All tasks — clears the filter, and unfiles a card dropped onto it */}
        <div className="group/chip relative" {...dropProps(null)}>
          <button
            onClick={() => onSelect(null)}
            className={`${CHIP_BASE} w-full ${
              dropTarget === null
                ? 'border-indigo-400/70 bg-indigo-500/[0.08] scale-[1.02]'
                : activeId === null
                  ? 'border-indigo-400/40 bg-indigo-500/[0.08]'
                  : CHIP_IDLE
            }`}
          >
            <Layers
              size={15}
              className={`shrink-0 transition-colors ${
                activeId === null || dropTarget === null
                  ? 'text-indigo-400'
                  : 'text-zinc-500 dark:text-zinc-200 group-hover/chip:text-indigo-400/70'
              }`}
            />
            <span
              className={`flex-1 text-[13px] font-medium truncate transition-colors ${
                activeId === null || dropTarget === null
                  ? 'text-zinc-800 dark:text-white'
                  : 'text-zinc-500 dark:text-zinc-200 group-hover/chip:text-zinc-800 dark:group-hover/chip:text-zinc-200'
              }`}
            >
              All tasks
            </span>
            <span className="text-[13px] tabular-nums text-zinc-500 dark:text-zinc-200 shrink-0">
              {total}
            </span>
          </button>
        </div>

        {projects.map((project, idx) => {
          const colorKey = resolveProjectColor(project, idx)
          const tint = PROJECT_COLORS[colorKey]
          const isActive = activeId === project.id
          const isDropTarget = dropTarget === project.id
          const lit = isActive || isDropTarget

          if (editingId === project.id) {
            return (
              <div key={project.id} className={`${CHIP_BASE} border-zinc-300 dark:border-white/[0.12] panel bg-zinc-50/60 dark:bg-white/[0.02]`}>
                <Folder size={15} className={`shrink-0 ${tint.icon}`} />
                <input
                  ref={editRef}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(project)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(project)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-zinc-800 dark:text-white outline-none"
                />
              </div>
            )
          }

          const folded = collapsed && idx >= MOBILE_CHIPS && !isActive

          return (
            <div
              key={project.id}
              ref={pickerId === project.id ? pickerRef : undefined}
              className={`group/chip relative ${folded ? foldClass : ''}`}
              {...dropProps(project.id)}
            >
              <div
                className={`${CHIP_BASE} ${
                  isDropTarget
                    ? `${tint.dropBorder} ${tint.bg} scale-[1.02]`
                    : isActive
                      ? `${tint.border} ${tint.bg}`
                      : CHIP_IDLE
                }`}
              >
                {/* Folder icon doubles as the colour-label button */}
                <button
                  onClick={() => setPickerId((id) => (id === project.id ? null : project.id))}
                  title={`Colour: ${tint.label}`}
                  className="shrink-0 flex items-center justify-center w-5 h-5 -ml-0.5 rounded-md hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] transition-colors"
                >
                  {lit
                    ? <FolderOpen size={15} className={tint.icon} />
                    : <Folder size={15} className={`transition-colors ${tint.icon}`} />
                  }
                </button>

                <button
                  onClick={() => { setPickerId(null); onSelect(isActive ? null : project.id) }}
                  onDoubleClick={() => { setEditingId(project.id); setEditName(project.name) }}
                  title={`${project.name} — double-click to rename`}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                >
                  <span
                    className={`flex-1 text-[13px] font-medium truncate transition-colors ${
                      lit
                        ? 'text-zinc-800 dark:text-white'
                        : 'text-zinc-500 dark:text-zinc-200 group-hover/chip:text-zinc-800 dark:group-hover/chip:text-zinc-200'
                    }`}
                  >
                    {project.name}
                  </span>
                  <span className="text-[13px] tabular-nums text-zinc-500 dark:text-zinc-200 shrink-0 group-hover/chip:opacity-0 transition-opacity">
                    {countFor(project.id)}
                  </span>
                </button>
              </div>

              <button
                onClick={() => {
                  if (!confirm(`Delete project "${project.name}"? Its tasks stay on the board.`)) return
                  onDelete(project.id)
                }}
                title="Delete project"
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/chip:opacity-100 flex items-center justify-center w-6 h-6 rounded-md text-zinc-500 dark:text-zinc-200 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
              >
                <Trash2 size={12} />
              </button>

              {/* Colour picker, anchored under the chip */}
              {pickerId === project.id && (
                <div className="absolute top-full left-0 mt-1.5 z-50 flex gap-1 p-1.5 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#17171f] shadow-xl">
                  {PROJECT_COLOR_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => { onSetColor(project.id, key); setPickerId(null) }}
                      title={PROJECT_COLORS[key].label}
                      className={`w-4 h-4 rounded-full transition-transform hover:scale-125 ${PROJECT_COLORS[key].swatch} ${
                        colorKey === key ? 'ring-2 ring-offset-1 ring-zinc-400 dark:ring-white/40 dark:ring-offset-[#17171f]' : ''
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Show the folded chips, and the New project button with them. Phone
            only — from `sm` up nothing is folded, so there is nothing to open. */}
        {collapsible && (
          <button
            onClick={() => setExpanded((s) => !s)}
            className="sm:hidden panel flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-zinc-200 dark:border-white/[0.08] text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-white hover:border-zinc-300 dark:hover:border-white/[0.14] transition-all"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Less' : `${foldedAway} more`}
          </button>
        )}

        {/* New project */}
        {adding ? (
          <form onSubmit={handleCreate} className={`${CHIP_BASE} border-dashed border-zinc-300 dark:border-white/[0.12]`}>
            <Folder size={15} className="shrink-0 text-zinc-500 dark:text-zinc-200" />
            <input
              ref={addRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => { if (!newName.trim()) setAdding(false) }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setNewName(''); setAdding(false) } }}
              placeholder="Project name…"
              className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-zinc-800 dark:text-white placeholder-zinc-500 dark:placeholder-zinc-400 outline-none"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setNewName(''); setAdding(false) }}
              className="shrink-0 text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
            >
              <X size={13} />
            </button>
          </form>
        ) : (
          // Wrapped rather than given `hidden` directly: CHIP_BASE already sets
          // `flex`, and putting both on one element leaves which wins to
          // Tailwind's own ordering.
          <div className={collapsed ? foldClass : ''}>
            <button
              onClick={() => setAdding(true)}
              className={`${CHIP_BASE} border-dashed border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-200 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-white/[0.14] hover:bg-zinc-50/50 dark:hover:bg-white/[0.02]`}
            >
              <Plus size={15} className="shrink-0" />
              <span className="text-[13px] font-medium">New project</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
