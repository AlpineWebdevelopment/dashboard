export const dynamic = 'force-dynamic'

import { getPrompt } from '@/lib/actions'
import { notFound } from 'next/navigation'
import PromptEditor from '@/components/PromptEditor'

export default async function PromptPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const prompt = await getPrompt(id)
  if (!prompt) notFound()

  return <PromptEditor prompt={prompt} />
}
