import { getSpreadsheet } from '@/lib/actions'
import TableEditor from '@/components/TableEditor'
import { notFound } from 'next/navigation'

export default async function TableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sheet = await getSpreadsheet(id)
  if (!sheet) notFound()

  // Back link, share and delete live in TableEditor's header bar alongside the
  // title, so they all sit on one surface.
  return (
    <div className="min-h-screen">
      <TableEditor sheet={sheet} />
    </div>
  )
}
