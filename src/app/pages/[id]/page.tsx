import { getPage } from '@/lib/actions'
import PageEditor from '@/components/PageEditor'
import ShareButton from '@/components/ShareButton'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const page = await getPage(id)
  if (!page) notFound()

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 flex items-center justify-between mb-2">
        <Link
          href="/pages"
          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <ChevronLeft size={13} />
          Pages
        </Link>
        <ShareButton id={page.id} type="page" initialToken={page.share_token ?? null} />
      </div>
      <PageEditor page={page} />
    </div>
  )
}
