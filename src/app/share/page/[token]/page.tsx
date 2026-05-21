import { getPageByShareToken } from '@/lib/actions'
import { notFound } from 'next/navigation'

export default async function SharedPageView({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const page = await getPageByShareToken(token)
  if (!page) notFound()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="border-b border-white/[0.06] bg-[rgba(7,7,15,0.9)] px-6 py-3 flex items-center justify-between">
        <span className="text-[11px] text-zinc-600 font-medium tracking-widest uppercase">View only</span>
        <span className="text-[11px] text-zinc-700">Shared via dashboard</span>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold text-zinc-100 mb-8 leading-tight tracking-tight">
          {page.title}
        </h1>
        <div className="text-zinc-300 text-[15px] leading-relaxed whitespace-pre-wrap">
          {page.content || <span className="text-zinc-600 italic">No content.</span>}
        </div>
      </div>
    </div>
  )
}
