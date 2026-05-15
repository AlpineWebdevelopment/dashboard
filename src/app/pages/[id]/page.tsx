import { getPage } from '@/lib/actions'
import PageEditor from '@/components/PageEditor'
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
      <div className="px-8 pt-8">
        <Link
          href="/pages"
          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-2"
        >
          <ChevronLeft size={13} />
          Pages
        </Link>
      </div>
      <PageEditor page={page} />
    </div>
  )
}
