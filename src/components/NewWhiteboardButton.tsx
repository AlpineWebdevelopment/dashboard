'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createWhiteboard } from '@/lib/actions'
import { PenTool, Loader2 } from 'lucide-react'

export default function NewWhiteboardButton() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      const id = await createWhiteboard()
      router.push(`/whiteboards/${id}`)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 hover:bg-fuchsia-500/15 hover:border-fuchsia-500/30 disabled:opacity-50 text-fuchsia-600 dark:text-fuchsia-400 text-[13px] font-medium transition-all duration-150"
    >
      {isPending ? <Loader2 size={13} className="animate-spin" /> : <PenTool size={13} />}
      {isPending ? 'Creating…' : 'New Whiteboard'}
    </button>
  )
}
