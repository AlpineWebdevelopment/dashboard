'use client'

import { useTransition } from 'react'
import { createPrompt } from '@/lib/actions'
import { Sparkles, Loader2 } from 'lucide-react'

export default function NewPromptButton() {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await createPrompt()
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15 hover:border-orange-500/30 disabled:opacity-50 text-orange-600 dark:text-orange-400 text-[13px] font-medium transition-all duration-150"
    >
      {isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      {isPending ? 'Creating…' : 'New Prompt'}
    </button>
  )
}
