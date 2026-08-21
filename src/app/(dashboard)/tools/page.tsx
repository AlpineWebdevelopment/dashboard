import Link from 'next/link'
import { ArrowUpRight, ShieldCheck } from 'lucide-react'
import { TOOLS, TOOL_ACCENTS } from '@/lib/tools/registry'

export const metadata = { title: 'Tools' }

export default function ToolsPage() {
  const owned = TOOLS.filter((t) => !t.external)
  const elsewhere = TOOLS.filter((t) => t.external)

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
          {owned.map((tool) => (
            <ToolCard key={tool.key} tool={tool} />
          ))}
        </div>

        {elsewhere.length > 0 && (
          <div className="mt-8 sm:mt-10">
            <p className="text-[13px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-4">
              Lives elsewhere
            </p>
            <div className="space-y-1.5">
              {elsewhere.map((tool) => {
                const c = TOOL_ACCENTS[tool.accent]
                const Icon = tool.icon
                return (
                  <Link
                    key={tool.key}
                    href={tool.href}
                    className={`group flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/[0.05] panel bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] ${c.hoverBorder} transition-all duration-200`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border ${c.tile}`}
                      >
                        <Icon size={13} className={c.icon} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-100 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors truncate">
                          {tool.name}
                        </p>
                        <p className="text-[13px] text-zinc-500 dark:text-zinc-200 truncate">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-[13px] text-zinc-500 dark:text-zinc-200 group-hover:text-zinc-800 dark:group-hover:text-white transition-colors">
                      {tool.href}
                      <ArrowUpRight size={11} />
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
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
