'use client'

import { useState } from 'react'
import {
  Moon, Sun, Eye, EyeOff, GripVertical, ChevronUp, ChevronDown, RotateCcw,
  Image as ImageIcon, Palette, PanelLeft, Lock,
} from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'
import { useNavPrefs } from '@/components/NavPrefsProvider'
import BackgroundControls from '@/components/BackgroundControls'
import { PINNED_KEY } from '@/lib/nav'

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        <div className="mb-8 sm:mb-10">
          <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
            Preferences
          </p>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
            Settings
          </h1>
          <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-200 leading-relaxed">
            Saved in this browser. Sign in on another device and you&apos;ll get the defaults —
            per-account settings arrive with accounts.
          </p>
        </div>

        <div className="space-y-4">
          <ThemeSection />
          <BackgroundSection />
          <SidebarSection />
        </div>
      </div>
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  accent,
  title,
  description,
  action,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  accent: string
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-white/[0.06] panel bg-white/60 dark:bg-white/[0.02] overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.04] flex items-center justify-center">
            <Icon size={15} className={accent} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-tight">
              {title}
            </h2>
            <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-200 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-5 sm:px-6 pb-5">{children}</div>
    </section>
  )
}

// ─── Theme ────────────────────────────────────────────────────────────────────

function ThemeSection() {
  const { theme, setTheme } = useTheme()

  return (
    <Section
      icon={Palette}
      accent="text-violet-400"
      title="Appearance"
      description="Light or dark. Applied instantly and remembered for next time."
    >
      <div className="inline-flex gap-1 p-1 rounded-xl border border-zinc-200 dark:border-white/[0.07] panel bg-zinc-50 dark:bg-white/[0.03]">
        <ThemeOption
          label="Light"
          icon={Sun}
          selected={theme === 'light'}
          onSelect={() => setTheme('light')}
        />
        <ThemeOption
          label="Dark"
          icon={Moon}
          selected={theme === 'dark'}
          onSelect={() => setTheme('dark')}
        />
      </div>
    </Section>
  )
}

function ThemeOption({
  label,
  icon: Icon,
  selected,
  onSelect,
}: {
  label: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
        selected
          ? 'bg-white dark:bg-white/[0.09] text-zinc-900 dark:text-white shadow-sm'
          : 'text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white'
      }`}
    >
      <Icon size={14} strokeWidth={selected ? 2 : 1.75} />
      {label}
    </button>
  )
}

// ─── Background ───────────────────────────────────────────────────────────────

function BackgroundSection() {
  const { theme } = useTheme()

  return (
    <Section
      icon={ImageIcon}
      accent="text-indigo-400"
      title="Background"
      description="Pick a wallpaper from your storage bucket, or none at all. Upload new images here too."
    >
      {theme === 'light' && (
        <p className="mb-4 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-[13px] text-amber-600 dark:text-amber-400">
          Wallpapers only show in dark mode — switch above to see your choice.
        </p>
      )}
      <BackgroundControls />
    </Section>
  )
}

// ─── Sidebar menu ─────────────────────────────────────────────────────────────

function SidebarSection() {
  const { entries, setEntries, reset } = useNavPrefs()
  const [dragKey, setDragKey] = useState<string | null>(null)

  const shown = entries.filter((e) => !e.hidden).length

  function move(from: number, to: number) {
    if (to < 0 || to >= entries.length || from === to) return
    const next = [...entries]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setEntries(next)
  }

  function toggleHidden(index: number) {
    setEntries(entries.map((e, i) => (i === index ? { ...e, hidden: !e.hidden } : e)))
  }

  return (
    <Section
      icon={PanelLeft}
      accent="text-sky-400"
      title="Sidebar menu"
      description={`Drag to reorder, hide what you don't use. ${shown} of ${entries.length} shown.`}
      action={
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-[13px] font-medium text-zinc-500 dark:text-zinc-200 hover:text-zinc-800 dark:hover:text-white transition-all"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      }
    >
      <ul className="space-y-1">
        {entries.map(({ item, hidden }, index) => {
          const Icon = item.icon
          const pinned = item.key === PINNED_KEY
          const dragging = dragKey === item.key

          return (
            <li
              key={item.key}
              draggable
              onDragStart={(e) => {
                setDragKey(item.key)
                e.dataTransfer.effectAllowed = 'move'
                // Firefox refuses to start a drag without payload
                e.dataTransfer.setData('navdrag', item.key)
              }}
              onDragEnd={() => setDragKey(null)}
              onDragOver={(e) => {
                e.preventDefault()
                if (!dragKey || dragKey === item.key) return
                const from = entries.findIndex((x) => x.item.key === dragKey)
                if (from >= 0) move(from, index)
              }}
              onDrop={(e) => e.preventDefault()}
              className={`group flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-xl border transition-all ${
                dragging
                  ? 'border-indigo-500/40 bg-indigo-500/[0.06] opacity-60'
                  : 'border-transparent hover:border-zinc-200 dark:hover:border-white/[0.07] hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
              }`}
            >
              <GripVertical
                size={14}
                className="shrink-0 cursor-grab active:cursor-grabbing text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300"
              />

              <Icon
                size={14}
                strokeWidth={1.75}
                className={hidden ? 'shrink-0 text-zinc-400 dark:text-zinc-500' : `shrink-0 ${item.iconActive}`}
              />

              <span
                className={`flex-1 min-w-0 truncate text-[13px] font-medium ${
                  hidden
                    ? 'text-zinc-500 dark:text-zinc-400 line-through decoration-zinc-400 dark:decoration-zinc-500'
                    : 'text-zinc-800 dark:text-white'
                }`}
              >
                {item.label}
              </span>

              {hidden && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[12px] font-medium text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.07]">
                  Hidden
                </span>
              )}

              <div className="shrink-0 flex items-center gap-0.5">
                <IconButton
                  label={`Move ${item.label} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ChevronUp size={13} />
                </IconButton>
                <IconButton
                  label={`Move ${item.label} down`}
                  disabled={index === entries.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronDown size={13} />
                </IconButton>

                {pinned ? (
                  // Hiding Settings would leave no way back into this page
                  <span
                    title="Settings can't be hidden"
                    className="w-6 h-6 flex items-center justify-center text-zinc-400 dark:text-zinc-500"
                  >
                    <Lock size={12} />
                  </span>
                ) : (
                  <IconButton
                    label={hidden ? `Show ${item.label}` : `Hide ${item.label}`}
                    onClick={() => toggleHidden(index)}
                  >
                    {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </IconButton>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-6 h-6 flex items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.07] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 dark:disabled:hover:text-zinc-400 transition-all"
    >
      {children}
    </button>
  )
}
