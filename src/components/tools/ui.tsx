'use client'

// Shared chrome for the /tools pages.
//
// The standalone tools project styled itself with its own `ui-*` component
// layer. None of that came across: these are the same primitives rebuilt on the
// dashboard's conventions — frosted `.panel` surfaces, a 13px type floor, and
// `dark:text-zinc-200` for resting secondary text. Read STYLING.md before
// changing a className here; every tool page inherits it.
//
// `nested` is the one thing to get right. `.panel` belongs on the individual
// card, row, input or standalone button — never on something already sitting
// inside a panelled card, where the card is the dark base and a second frosted
// layer only dims the wallpaper twice. Pass `nested` for those.

import Link from 'next/link'
import { ArrowLeft, Upload } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { TOOL_ACCENTS, type Tool, type ToolAccent } from '@/lib/tools/registry'

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

export const CARD_CLS =
  'panel rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02]'

/* ── Header ───────────────────────────────────────────────────────────────── */

export function ToolHeader({
  tool,
  actions,
  compact = false,
}: {
  tool: Tool
  actions?: ReactNode
  compact?: boolean
}) {
  const c = TOOL_ACCENTS[tool.accent]
  const Icon = tool.icon
  return (
    <div className={compact ? 'mb-4' : 'mb-6 sm:mb-8'}>
      <Link
        href="/tools"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-colors mb-2 sm:mb-3"
      >
        <ArrowLeft size={11} />
        Tools
      </Link>
      <div className="flex items-start sm:items-end justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-xl border ${c.tile}`}
          >
            <Icon size={16} className={c.icon} />
          </span>
          <div className="min-w-0">
            <h1
              className={`${
                compact ? 'text-lg sm:text-xl' : 'text-2xl sm:text-[28px]'
              } font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight`}
            >
              {tool.name}
            </h1>
            {!compact && (
              <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mt-1 leading-relaxed">
                {tool.tagline}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-all duration-150 disabled:opacity-45 disabled:pointer-events-none'

export function btnPrimary(accent: ToolAccent, nested = false) {
  return `${BTN_BASE} ${nested ? '' : 'panel '}${TOOL_ACCENTS[accent].button}`
}

export function btnSecondary(nested = false) {
  return `${BTN_BASE} ${
    nested ? '' : 'panel '
  }bg-zinc-100/60 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-zinc-200 hover:bg-zinc-200/70 dark:hover:bg-white/[0.07] hover:text-zinc-900 dark:hover:text-white`
}

export function btnGhost() {
  return `${BTN_BASE} text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]`
}

export function btnDanger(nested = false) {
  return `${BTN_BASE} ${
    nested ? '' : 'panel '
  }border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-500/50`
}

/* ── Inputs ───────────────────────────────────────────────────────────────── */

export function inputCls(accent: ToolAccent, nested = false) {
  return `w-full ${
    nested ? '' : 'panel '
  }rounded-lg border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-800 dark:text-zinc-100 placeholder-zinc-500 dark:placeholder-zinc-400 outline-none ${
    TOOL_ACCENTS[accent].focus
  } transition-colors`
}

/** Small uppercase caption above a field or readout cell. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2">
      {children}
    </span>
  )
}

/* ── Segmented control ────────────────────────────────────────────────────── */

/**
 * Options rendered as one pill row. The *container* carries `.panel` when it
 * stands on its own; the active pill never does — a frosted layer under an
 * opaque highlight is wasted paint.
 */
export function Segmented<T extends string>({
  accent,
  value,
  options,
  onChange,
  nested = false,
}: {
  accent: ToolAccent
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  nested?: boolean
}) {
  const c = TOOL_ACCENTS[accent]
  return (
    <div
      className={`flex gap-1 ${
        nested ? '' : 'panel '
      }rounded-xl border border-zinc-200 dark:border-white/[0.07] bg-zinc-50 dark:bg-white/[0.03] p-1`}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 min-w-16 rounded-lg border px-2 py-1.5 text-[13px] font-medium transition-all duration-150 ${
              on
                ? c.segment
                : 'border-transparent text-zinc-500 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05]'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ── Drop zone ────────────────────────────────────────────────────────────── */

/**
 * Click-or-drop file target at the top of both converters. Lives inside the
 * page's panelled card, so it carries no `.panel` of its own.
 */
export function DropZone({
  accept,
  multiple = false,
  title,
  hint,
  inputRef,
  onFiles,
}: {
  accept: string
  multiple?: boolean
  title: string
  hint: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onFiles: (files: FileList) => void
}) {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
      }}
      className={`relative px-7 py-11 text-center cursor-pointer rounded-t-2xl transition-colors ${
        dragging
          ? 'bg-zinc-100 dark:bg-white/[0.06] ring-2 ring-inset ring-zinc-300 dark:ring-white/20'
          : 'hover:bg-zinc-100/70 dark:hover:bg-white/[0.03]'
      }`}
    >
      <div className="w-11 h-11 mx-auto mb-4 grid place-items-center rounded-xl border border-zinc-200 dark:border-white/[0.08] text-zinc-500 dark:text-zinc-200">
        <Upload size={18} />
      </div>
      <p className="text-sm font-medium text-zinc-800 dark:text-white">
        {title}{' '}
        <span className="underline underline-offset-[3px] decoration-zinc-300 dark:decoration-white/25">
          browse
        </span>
      </p>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mt-2">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/* ── Readout ──────────────────────────────────────────────────────────────── */

/** The four-up stat strip both converters show once a file is loaded. */
export function Readout({ cells }: { cells: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-zinc-200 dark:border-white/[0.06]">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={`px-4 py-3 border-zinc-200 dark:border-white/[0.06] ${
            i % 2 === 1 ? 'border-l' : ''
          } ${i >= 2 ? 'border-t sm:border-t-0' : ''} ${i >= 1 ? 'sm:border-l' : ''}`}
        >
          <div className="text-[12px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-1">
            {cell.label}
          </div>
          <div className="text-sm font-medium text-zinc-800 dark:text-white tabular-nums">
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Status line ──────────────────────────────────────────────────────────── */

export type Status = { msg: string; type: 'info' | 'ok' | 'err' } | null

export function StatusLine({ status }: { status: Status }) {
  if (!status) return <div className="min-h-5 mt-3" />
  const color =
    status.type === 'err'
      ? 'text-red-600 dark:text-red-400'
      : status.type === 'ok'
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-zinc-500 dark:text-zinc-200'
  return (
    <div className={`min-h-5 mt-3 text-center text-[13px] tabular-nums ${color}`}>
      {status.msg}
    </div>
  )
}

/* ── Modal ────────────────────────────────────────────────────────────────── */

/**
 * Modal shell. Deliberately opaque and deliberately *not* `.panel` — modal
 * shells are one of STYLING.md's listed exclusions, and a backdrop-filter here
 * would make this the containing block for anything fixed inside it.
 */
export function Modal({
  onClose,
  children,
  wide = false,
}: {
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`relative w-full ${
          wide ? 'max-w-5xl h-[90vh]' : 'max-w-md'
        } flex flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#0e0e18] shadow-2xl`}
      >
        {children}
      </div>
    </div>
  )
}

/* ── Empty state ──────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: Tool['icon']
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
      <div className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] flex items-center justify-center">
        <Icon size={16} className="text-zinc-500 dark:text-zinc-200" />
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-200">{title}</p>
      {hint && <p className="text-[13px] text-zinc-500 dark:text-zinc-200">{hint}</p>}
    </div>
  )
}
