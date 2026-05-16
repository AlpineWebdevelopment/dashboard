import { getSpreadsheet } from '@/lib/actions'
import TableEditor from '@/components/TableEditor'
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
      <div className="px-8 pt-8">
        <Link
          href="/tables"
          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <ChevronLeft size={13} />
          Tables
        </Link>
      </div>
      <TableEditor sheet={sheet} />
    </div>
  )
}
