export const dynamic = 'force-dynamic'

import { getWhiteboard } from '@/lib/actions'
import { notFound } from 'next/navigation'
import ExcalidrawCanvas from '@/components/ExcalidrawCanvas'

export default async function WhiteboardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const board = await getWhiteboard(id)
  if (!board) notFound()

  return <ExcalidrawCanvas whiteboard={board} />
}
