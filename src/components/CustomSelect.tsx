'use client'

// The app's one dropdown.
//
// Native <select> renders as an OS widget — it ignores the panel surface, the
// dark palette and the rounded geometry every other control here uses. This is
// the button-plus-list stand-in that the task card modal introduced; every
// select in the app now goes through it so they all look the same.
//
// The list is rendered into <body> and positioned from the trigger's rect
// rather than sitting inside the field. Several call sites live in scrollable
// modals and overflow-x tables, and an absolutely-positioned menu gets clipped
// by those; a fixed portal spills past them. It stays inside the window: with
// no room underneath the field the list opens upwards instead.

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

const MENU_MAX_HEIGHT = 260
const ROW_HEIGHT = 36
const GAP = 4

export type SelectOption = { value: string; label: string }

type MenuPos = {
  left: number
  width: number
  maxWidth?: number
  top?: number
  bottom?: number
  maxHeight: number
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  small,
  disabled,
  ariaLabel,
  title,
  triggerClassName,
  menuMaxWidth,
}: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  small?: boolean
  disabled?: boolean
  ariaLabel?: string
  title?: string
  /**
   * Replaces the trigger's field surface (fill, border, padding, text) so a
   * form built on another input style can have a dropdown that sits level
   * with the inputs beside it — the /tools pages pass their inputCls here.
   * The menu is untouched, so the opened list still matches the rest of the
   * app. `small` has no effect alongside it.
   */
  triggerClassName?: string
  /**
   * Caps how far the menu may outgrow its trigger, in px, and ellipsises the
   * labels that no longer fit. Opt-in: without it the list sizes to its longest
   * label, which is what every call site with short fixed labels wants. Pass it
   * where the options are long free text — the email sender builds its labels
   * from a user-typed icon plus a user-typed name, and an unbounded menu
   * hanging off a half-width trigger ran away across the screen.
   */
  menuMaxWidth?: number
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)
  const label = placeholder && !value ? placeholder : (selected?.label ?? options[0]?.label ?? '')
  const muted = !!placeholder && !value

  const measure = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const wanted = Math.min(options.length * ROW_HEIGHT + 8, MENU_MAX_HEIGHT)
    const below = window.innerHeight - rect.bottom - 12
    const above = rect.top - 12
    const dropUp = below < wanted && above > below
    // Uncapped, this stays exactly as it was: no maxWidth, left pinned to the
    // trigger. Capped, the menu also has to be pulled back off the right edge,
    // since a bounded width is the only case that can overhang it.
    const maxWidth = menuMaxWidth
      ? Math.max(rect.width, Math.min(menuMaxWidth, window.innerWidth - 24))
      : undefined
    setPos({
      left: maxWidth
        ? Math.max(12, Math.min(rect.left, window.innerWidth - maxWidth - 12))
        : rect.left,
      width: rect.width,
      maxWidth,
      ...(dropUp
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
      maxHeight: Math.min(MENU_MAX_HEIGHT, Math.max(dropUp ? above : below, 120)),
    })
  }, [options.length, menuMaxWidth])

  // Keep the list glued to the field while the page moves under it.
  useEffect(() => {
    if (!open) return
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open, measure])

  // The menu is a sibling of the trigger in the DOM, so "outside" has to
  // exclude both of them or mousedown would close it before the click lands.
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle() {
    if (disabled) return
    if (!open) measure()
    setOpen((s) => !s)
  }

  // The placeholder tint sits on the label span rather than the button, so a
  // caller-supplied surface can carry its own text colour without the two
  // fighting over the same property.
  const surface =
    triggerClassName ??
    `panel bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.07] rounded-lg text-zinc-700 dark:text-zinc-100 hover:border-zinc-300 dark:hover:border-white/[0.12] ${
      small ? 'px-2 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'
    }`

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={title}
        className={`w-full flex items-center justify-between gap-2 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${surface}`}
      >
        <span className={`truncate ${muted ? 'text-zinc-500 dark:text-zinc-200' : ''}`}>{label}</span>
        <ChevronDown size={12} className={`shrink-0 text-zinc-500 dark:text-zinc-200 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            minWidth: pos.width,
            maxWidth: pos.maxWidth,
            maxHeight: pos.maxHeight,
          }}
          className="z-[100] overflow-y-auto overscroll-contain bg-white dark:bg-[#17171f] border border-zinc-200 dark:border-white/[0.08] rounded-xl shadow-xl py-1"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              title={menuMaxWidth ? o.label : undefined}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                menuMaxWidth ? 'truncate' : 'whitespace-nowrap'
              } ${
                o.value === value
                  ? 'panel bg-zinc-100 dark:bg-white/[0.06] text-zinc-900 dark:text-white'
                  : 'text-zinc-700 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
