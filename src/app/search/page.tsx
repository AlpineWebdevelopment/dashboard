export const dynamic = 'force-dynamic'

import { searchAll } from '@/lib/actions'
import Link from 'next/link'
import { FileText, Table2, SearchX } from 'lucide-react'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { q } = await searchParams
  const query = typeof q === 'string' ? q : ''
  const results = query ? await searchAll(query) : []

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-2xl">
        <div className="mb-8 sm:mb-10">
          <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-3">
            Search
          </p>
          {query ? (
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-100 tracking-tight leading-tight break-words">
              "{query}"
            </h1>
          ) : (
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-700 tracking-tight leading-tight">
              Type to search…
            </h1>
          )}
          {query && (
            <p className="text-xs text-zinc-600 mt-2">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Mobile search input */}
        <MobileSearchForm initialQuery={query} />

        {query && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 sm:py-24 rounded-2xl border border-dashed border-white/[0.06]">
            <SearchX size={20} className="text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">No results for "{query}"</p>
            <p className="text-xs text-zinc-700 mt-1">Try a different keyword</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((result) => (
              <Link
                key={result.id}
                href={result.type === 'page' ? `/pages/${result.id}` : `/tables/${result.id}`}
                className="group relative flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4 rounded-xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.09] transition-all duration-200 overflow-hidden"
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover:h-8 rounded-r-full bg-indigo-400/60 transition-all duration-200" />

                <div className="shrink-0 mt-0.5">
                  {result.type === 'page'
                    ? <FileText size={13} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    : <Table2 size={13} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors truncate">
                    {result.title}
                  </p>
                  {result.snippet && (
                    <p className="text-xs text-zinc-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {result.snippet}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.04] text-zinc-700 capitalize">
                    {result.type}
                  </span>
                  <span className="text-[10px] text-zinc-700 tabular-nums hidden sm:block">
                    {timeAgo(result.updated_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Mobile search form (visible only on mobile where the sidebar search bar is hidden)
function MobileSearchForm({ initialQuery }: { initialQuery: string }) {
  return (
    <form action="/search" method="get" className="md:hidden mb-6">
      <div className="relative flex items-center">
        <svg
          className="absolute left-3 text-zinc-600 pointer-events-none"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          name="q"
          type="search"
          defaultValue={initialQuery}
          placeholder="Search pages and tables…"
          autoFocus={!initialQuery}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500/40 focus:bg-white/[0.06] transition-all"
        />
      </div>
    </form>
  )
}
