export const dynamic = 'force-dynamic'

import { getPages } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import Link from 'next/link'
import { FileText, ArrowRight, Clock } from 'lucide-react'

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
  const pages = await getPages()
  const recent = pages.slice(0, 5)

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-8 py-10 max-w-4xl">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            {greeting()} 👋
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Here's what's going on today.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <StatCard label="Total Pages" value={pages.length} />
          <StatCard
            label="Last Updated"
            value={pages[0] ? timeAgo(pages[0].updated_at) : '—'}
          />
          <StatCard
            label="Words Written"
            value={pages.reduce(
              (acc, p) => acc + (p.content?.split(/\s+/).filter(Boolean).length ?? 0),
              0
            )}
          />
        </div>

        {/* Recent pages */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">
              Recent Pages
            </h2>
            <Link
              href="/pages"
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {recent.length === 0 ? (
            <EmptyState configured={supabaseConfigured} />
          ) : (
            <div className="space-y-2">
              {recent.map((page) => (
                <Link
                  key={page.id}
                  href={`/pages/${page.id}`}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={15} className="text-zinc-600 shrink-0" />
                    <span className="text-sm text-zinc-300 truncate group-hover:text-zinc-100 transition-colors">
                      {page.title || 'Untitled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600 shrink-0 ml-4">
                    <Clock size={11} />
                    {timeAgo(page.updated_at)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-5 py-4">
      <p className="text-xs text-zinc-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-semibold text-zinc-100 tracking-tight">{value}</p>
    </div>
  )
}

function EmptyState({ configured }: { configured: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-xl bg-white/[0.02] border border-white/[0.06] border-dashed">
      <FileText size={28} className="text-zinc-700 mb-3" />
      <p className="text-sm text-zinc-500 mb-4">
        {configured ? 'No pages yet. Start writing.' : 'Connect Supabase to start saving pages.'}
      </p>
      {configured && (
        <Link
          href="/pages"
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          Create your first page
        </Link>
      )}
    </div>
  )
}
