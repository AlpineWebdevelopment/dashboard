export const dynamic = 'force-dynamic'

import { getPages } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import NewPageButton from '@/components/NewPageButton'
import Link from 'next/link'
import { FileText } from 'lucide-react'

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

export default async function PagesPage() {
  const pages = await getPages()

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-8 pt-10 pb-16 max-w-3xl">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-3">
              Collection
            </p>
            <h1 className="text-[28px] font-semibold text-zinc-100 tracking-tight leading-tight">
              Pages
            </h1>
          </div>
          {supabaseConfigured && <NewPageButton />}
        </div>

        {/* List */}
        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 rounded-2xl border border-dashed border-white/[0.06]">
            <div className="w-11 h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4">
              <FileText size={16} className="text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 mb-1">
              {supabaseConfigured ? 'No pages yet' : 'Supabase not connected'}
            </p>
            <p className="text-xs text-zinc-700">
              {supabaseConfigured ? 'Hit "New Page" to get started' : 'Add env vars to start saving'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {pages.map((page, i) => (
              <Link
                key={page.id}
                href={`/pages/${page.id}`}
                className="group relative flex items-center justify-between px-5 py-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.09] transition-all duration-200 overflow-hidden"
              >
                {/* Hover left accent */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full bg-indigo-400/60 transition-all duration-200" />

                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-[11px] text-zinc-700 tabular-nums w-5 text-right shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors truncate">
                      {page.title || 'Untitled'}
                    </p>
                    {page.content ? (
                      <p className="text-xs text-zinc-600 mt-0.5 truncate">
                        {page.content.slice(0, 72) + (page.content.length > 72 ? '…' : '')}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-700 mt-0.5 italic">Empty</p>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 ml-6 tabular-nums">
                  {timeAgo(page.updated_at)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
