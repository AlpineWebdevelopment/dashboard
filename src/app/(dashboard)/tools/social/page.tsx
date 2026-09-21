export const dynamic = 'force-dynamic'

import { getPosts, getSocialOverview } from '@/lib/social/actions'
import BulkEditor from '@/components/tools/social/BulkEditor'

export const metadata = { title: 'Social Scheduler' }

// The social tables are service-role only (RLS on, no policy), so everything is
// fetched here and handed to the editor; /tools is already admin-only.
export default async function SocialSchedulerPage() {
  const [overview, posts] = await Promise.all([getSocialOverview(), getPosts()])
  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-6xl">
        <BulkEditor overview={overview} initialPosts={posts} />
      </div>
    </div>
  )
}
