'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createFolder } from '@/lib/actions'
import { FolderPlus, Loader2 } from 'lucide-react'

export default function NewFolderButton({ type }: { type: 'pages' | 'tables' }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      const id = await createFolder(type)
      router.push(`/${type}?folder=${id}`)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/[0.1] bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-50 text-zinc-200 text-[13px] font-medium transition-all duration-150"
    >
      {isPending ? <Loader2 size={13} className="animate-spin" /> : <FolderPlus size={13} />}
      {isPending ? 'Creating…' : 'New Folder'}
    </button>
  )
}
