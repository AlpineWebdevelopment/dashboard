import { getPage } from '@/lib/actions'
import PageEditor from '@/components/PageEditor'
import { notFound } from 'next/navigation'

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const page = await getPage(id)
  if (!page) notFound()

  // Back link, share and delete live in PageEditor's header bar alongside the
  // title, so they all sit on one surface.
  return (
    <div className="min-h-screen">
      <PageEditor page={page} />
    </div>
  )
}
