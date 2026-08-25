import Link from 'next/link'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { TOOLS, TOOL_ACCENTS } from '@/lib/tools/registry'

export const metadata = { title: 'Tools' }

export default function ToolsPage() {
  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        <div className="mb-8 sm:mb-10">
          <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-2 sm:mb-3">
            Utilities
          </p>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-white tracking-tight leading-tight">
            Tools
          </h1>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mt-2 leading-relaxed">
            The standalone tools, folded into the dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.key} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ToolCard({ tool }: { tool: (typeof TOOLS)[number] }) {
  const c = TOOL_ACCENTS[tool.accent]
  const Icon = tool.icon
  return (
    <Link
      href={tool.href}
      className={`group relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] p-5 flex flex-col gap-3 ${c.hoverBorder} hover:scale-[1.01] transition-all duration-150`}
    >
      <div
        className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${c.via} to-transparent`}
      />
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center justify-center w-10 h-10 rounded-xl border ${c.tile}`}
        >
          <Icon size={17} className={c.icon} />
        </span>
        <ArrowUpRight
          size={14}
          className="text-zinc-500 dark:text-zinc-200 group-hover:text-zinc-700 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all"
        />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white tracking-tight">
          {tool.name}
        </h2>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mt-1 leading-relaxed">
          {tool.description}
        </p>
      </div>
      {tool.offline && (
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/70 dark:bg-white/[0.04] px-2 py-0.5 text-[12px] font-medium text-zinc-500 dark:text-zinc-200">
          <ShieldCheck size={11} />
          Runs on your device
        </span>
      )}
    </Link>
  )
}
