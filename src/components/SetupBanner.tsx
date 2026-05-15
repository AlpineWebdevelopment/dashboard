import { AlertTriangle } from 'lucide-react'

export default function SetupBanner() {
  return (
    <div className="mx-8 mt-6 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
      <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-amber-300 font-medium">Supabase not connected</p>
        <p className="text-amber-500/80 text-xs mt-0.5">
          Create a <code className="font-mono bg-amber-500/10 px-1 rounded">.env.local</code> file with your{' '}
          <code className="font-mono bg-amber-500/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
          <code className="font-mono bg-amber-500/10 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable saving.
        </p>
      </div>
    </div>
  )
}
