export const dynamic = 'force-dynamic'

import { getPosts, getSocialOverview } from '@/lib/social/actions'
import SocialCalendar from '@/components/tools/social/SocialCalendar'

export const metadata = { title: 'Social Scheduler · Calendar' }

export default async function SocialCalendarPage() {
  const [overview, posts] = await Promise.all([getSocialOverview(), getPosts()])
  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-6xl">
        <SocialCalendar overview={overview} initialPosts={posts} />
      </div>
    </div>
  )
}
