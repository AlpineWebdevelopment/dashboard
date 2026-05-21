import { getSpreadsheet } from '@/lib/actions'
import TableEditor from '@/components/TableEditor'
import ShareButton from '@/components/ShareButton'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sheet = await getSpreadsheet(id)
  if (!sheet) notFound()

  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 flex items-center justify-between mb-2">
        <Link
          href="/tables"
          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <ChevronLeft size={13} />
          Tables
        </Link>
        <ShareButton id={sheet.id} type="table" initialToken={sheet.share_token ?? null} />
      </div>
      <TableEditor sheet={sheet} />
    </div>
  )
}
