export const dynamic = 'force-dynamic'

import { getThoughts } from '@/lib/actions'
import ThoughtsFeed from '@/components/ThoughtsFeed'

export default async function StreamPage() {
  const thoughts = await getThoughts()
  return <ThoughtsFeed initialThoughts={thoughts} />
}
