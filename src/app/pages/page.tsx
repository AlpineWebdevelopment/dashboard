export const dynamic = 'force-dynamic'

import { getPages } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import NewPageButton from '@/components/NewPageButton'
import Link from 'next/link'
import { FileText, Clock } from 'lucide-react'

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

      <div className="px-8 py-10 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Pages</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {pages.length === 0
                ? 'No pages yet.'
                : `${pages.length} page${pages.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {supabaseConfigured && <NewPageButton />}
        </div>

        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-xl bg-white/[0.02] border border-white/[0.06] border-dashed">
            <FileText size={32} className="text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500 mb-1">
              {supabaseConfigured ? 'No pages yet' : 'Supabase not connected'}
            </p>
            <p className="text-xs text-zinc-600">
              {supabaseConfigured ? 'Hit "New Page" to get started' : 'Add your env vars to start saving'}
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {pages.map((page) => (
              <Link
                key={page.id}
                href={`/pages/${page.id}`}
                className="flex items-center justify-between px-5 py-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-zinc-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors truncate">
                      {page.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5 truncate">
                      {page.content
                        ? page.content.slice(0, 80) + (page.content.length > 80 ? '…' : '')
                        : 'Empty page'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-600 shrink-0 ml-6">
                  <Clock size={11} />
                  {timeAgo(page.updated_at)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
