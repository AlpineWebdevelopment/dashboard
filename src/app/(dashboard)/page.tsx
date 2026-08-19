export const dynamic = 'force-dynamic'

import { getLists, getMrrClients, getPages, getTasks, getScratchPad } from '@/lib/actions'
import { isDoneList, isFinished } from '@/lib/task-views'
import { getDeployInfo } from '@/lib/deploy'
import { earnedForMonth, fmtMoney, fmtMoneyCompact, mrrForMonth } from '@/lib/mrr'
import SetupBanner from '@/components/SetupBanner'
import ScratchPad from '@/components/ScratchPad'
import PageGreeting from '@/components/PageGreeting'
import Link from 'next/link'
import { FileText, ArrowUpRight } from 'lucide-react'

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
  const [pages, tasks, lists, scratch, mrrClients] = await Promise.all([
    getPages(),
    getTasks(),
    getLists(),
    getScratchPad(),
    getMrrClients(),
  ])

  const recent = pages.slice(0, 5)
  const now = new Date()
  const currentMonthIdx = now.getFullYear() * 12 + now.getMonth()
  const earnedThisMonth = earnedForMonth(mrrClients, currentMonthIdx)
  const currentMrr = mrrForMonth(mrrClients, currentMonthIdx)
  // A task counts as done if it's flagged or sits in the Done column. Both this
  // and the board go through isFinished, so the tile and the page it links to
  // can no longer disagree about what "open" means.
  const doneListId = lists.find(isDoneList)?.id ?? null
  const openTasks = tasks.filter((t) => !isFinished(t, doneListId)).length

  const deploy = getDeployInfo()
  const deployLabel =
    deploy.source === 'commit' ? deploy.subject || deploy.sha : 'deployed'
  const deployTitle = [
    new Date(deploy.at).toLocaleString(),
    deploy.sha && `commit ${deploy.sha}`,
    deploy.source === 'build' && 'build time',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        {/* Header */}
        <div className="mb-8 sm:mb-12">
          <p className="text-[13px] font-medium tracking-widest uppercase text-zinc-500 dark:text-zinc-200 mb-3">
            Overview
          </p>
          <PageGreeting />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-8 sm:mb-12">
          <GlassCard
            label="Open tasks"
            value={openTasks}
            sub={`of ${tasks.length} total`}
            href="/tasks"
            accent="violet"
          />
          <GlassCard
            label="Earned this month"
            value={fmtMoneyCompact(earnedThisMonth)}
            sub={`${fmtMoney(currentMrr)} MRR`}
            href="/mrr"
            accent="teal"
          />
          <div className="col-span-2 sm:col-span-1">
            <GlassCard
              label="Last edit"
              value={timeAgo(deploy.at)}
              sub={deployLabel ?? 'deployed'}
              title={deployTitle}
              accent="emerald"
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
            <p className="text-[13px] font-semibold tracking-widest uppercase text-zinc-500 dark:text-zinc-200">
              Recent pages
            </p>
            <Link
              href="/pages"
              className="flex items-center gap-1 text-[13px] text-zinc-500 dark:text-zinc-200 hover:text-sky-400 transition-colors"
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
                  className="group flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/[0.05] panel bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-sky-500/[0.04] hover:border-sky-500/20 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-sky-400 transition-colors duration-200 shrink-0" />
                    <span className="text-sm text-zinc-500 dark:text-zinc-200 group-hover:text-zinc-800 dark:group-hover:text-white transition-colors truncate">
                      {page.title || 'Untitled'}
                    </span>
                  </div>
                  <span className="text-[13px] text-zinc-500 dark:text-zinc-200 group-hover:text-zinc-700 dark:group-hover:text-white transition-colors shrink-0 ml-4 tabular-nums">
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

const accentStyles = {
  violet: {
    via: 'via-violet-400/30',
    from: 'from-violet-500/[0.05]',
    label: 'text-violet-400/70',
    value: 'text-violet-600 dark:text-violet-100',
  },
  sky: {
    via: 'via-sky-400/30',
    from: 'from-sky-500/[0.05]',
    label: 'text-sky-400/70',
    value: 'text-sky-600 dark:text-sky-100',
  },
  emerald: {
    via: 'via-emerald-400/30',
    from: 'from-emerald-500/[0.05]',
    label: 'text-emerald-400/70',
    value: 'text-emerald-600 dark:text-emerald-100',
  },
  teal: {
    via: 'via-teal-400/30',
    from: 'from-teal-500/[0.05]',
    label: 'text-teal-400/70',
    value: 'text-teal-600 dark:text-teal-100',
  },
}

function GlassCard({
  label,
  value,
  sub,
  href,
  title,
  accent = 'violet',
}: {
  label: string
  value: string | number
  sub: string
  href?: string
  title?: string
  accent?: keyof typeof accentStyles
}) {
  const c = accentStyles[accent]
  const inner = (
    <div
      title={title}
      className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-50 dark:bg-white/[0.03] backdrop-blur-sm p-4 sm:p-5 group h-full"
    >
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent ${c.via} to-transparent`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${c.from} via-transparent to-transparent pointer-events-none`} />
      <p className={`text-[12px] font-semibold tracking-widest uppercase ${c.label} mb-3 sm:mb-4`}>
        {label}
      </p>
      <p className={`text-2xl sm:text-[28px] font-semibold ${c.value} tracking-tight tabular-nums leading-none`}>
        {value}
      </p>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-200 mt-1.5 truncate">{sub}</p>
    </div>
  )
  return href ? (
    <Link href={href} className="block hover:scale-[1.02] transition-transform duration-150 h-full">
      {inner}
    </Link>
  ) : inner
}

function EmptyState({ configured }: { configured: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
      <div className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-100/60 dark:bg-white/[0.03] flex items-center justify-center mb-4">
        <FileText size={15} className="text-zinc-500 dark:text-zinc-200" />
      </div>
      <p className="text-sm text-zinc-500 mb-1 dark:text-zinc-200">
        {configured ? 'No pages yet' : 'Connect Supabase to start'}
      </p>
      {configured && (
        <Link
          href="/pages"
          className="mt-4 px-4 py-2 rounded-lg text-[13px] font-medium border border-zinc-200 dark:border-white/[0.08] panel bg-zinc-100/60 dark:bg-white/[0.04] text-zinc-500 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/[0.07] hover:text-zinc-800 dark:hover:text-white transition-all"
        >
          Create first page
        </Link>
      )}
    </div>
  )
}
