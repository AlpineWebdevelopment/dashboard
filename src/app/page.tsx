export const dynamic = 'force-dynamic'

import { getPages, getTasks, getScratchPad } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import ScratchPad from '@/components/ScratchPad'
import Link from 'next/link'
import { FileText, ArrowUpRight } from 'lucide-react'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function HomePage() {
  const [pages, tasks, scratch] = await Promise.all([
    getPages(),
    getTasks(),
    getScratchPad(),
  ])

  const recent = pages.slice(0, 5)
  const wordCount = pages.reduce(
    (acc, p) => acc + (p.content?.split(/\s+/).filter(Boolean).length ?? 0),
    0
  )
  const openTasks = tasks.filter((t) => !t.done).length

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-3">
            Overview
          </p>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-100 tracking-tight leading-tight">
            {greeting()}
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-8 sm:mb-12">
          <GlassCard label="Open tasks" value={openTasks} sub={`of ${tasks.length} total`} href="/tasks" />
          <GlassCard label="Pages" value={pages.length} sub={`${wordCount.toLocaleString()} words`} href="/pages" />
          <div className="col-span-2 sm:col-span-1">
            <GlassCard
              label="Last edit"
              value={pages[0] ? timeAgo(pages[0].updated_at) : '—'}
              sub="updated"
            />
          </div>
        </div>

        {/* Scratch pad */}
        <div className="mb-8 sm:mb-12">
          <ScratchPad initial={scratch} />
        </div>

        {/* Recent pages */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-zinc-600">
              Recent pages
            </p>
            <Link
              href="/pages"
              className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              All pages <ArrowUpRight size={10} />
            </Link>
          </div>

          {recent.length === 0 ? (
            <EmptyState configured={supabaseConfigured} />
          ) : (
            <div className="space-y-1">
              {recent.map((page) => (
                <Link
                  key={page.id}
                  href={`/pages/${page.id}`}
                  className="group flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1 h-1 rounded-full bg-zinc-700 group-hover:bg-indigo-400 transition-colors duration-200 shrink-0" />
                    <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors truncate">
                      {page.title || 'Untitled'}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 ml-4 tabular-nums">
                    {timeAgo(page.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function GlassCard({
  label,
  value,
  sub,
  href,
}: {
  label: string
  value: string | number
  sub: string
  href?: string
}) {
  const inner = (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-5 group h-full">
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
      <p className="text-[10px] font-semibold tracking-widest uppercase text-zinc-600 mb-3 sm:mb-4">
        {label}
      </p>
      <p className="text-2xl sm:text-[28px] font-semibold text-zinc-100 tracking-tight tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[11px] text-zinc-700 mt-1.5">{sub}</p>
    </div>
  )
  return href ? (
    <Link href={href} className="block hover:scale-[1.02] transition-transform duration-150">
      {inner}
    </Link>
  ) : inner
}

function EmptyState({ configured }: { configured: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 rounded-2xl border border-dashed border-white/[0.06]">
      <div className="w-10 h-10 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4">
        <FileText size={15} className="text-zinc-600" />
      </div>
      <p className="text-sm text-zinc-500 mb-1">
        {configured ? 'No pages yet' : 'Connect Supabase to start'}
      </p>
      {configured && (
        <Link
          href="/pages"
          className="mt-4 px-4 py-2 rounded-lg text-xs font-medium border border-white/[0.08] bg-white/[0.04] text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-200 transition-all"
        >
          Create first page
        </Link>
      )}
    </div>
  )
}
