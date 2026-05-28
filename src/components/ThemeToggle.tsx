'use client'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium text-zinc-500 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-all duration-150"
    >
      {theme === 'dark' ? <Sun size={14} strokeWidth={1.75} className="shrink-0" /> : <Moon size={14} strokeWidth={1.75} className="shrink-0" />}
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
