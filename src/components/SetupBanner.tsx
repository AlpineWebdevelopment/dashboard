import { AlertTriangle } from 'lucide-react'

export default function SetupBanner() {
  return (
    <div className="mx-4 sm:mx-8 mt-4 sm:mt-6">
      <div className="relative overflow-hidden flex items-start gap-3 px-4 py-3.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.06]">
        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
        <AlertTriangle size={14} className="text-amber-500/80 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-amber-400/90">Supabase not connected</p>
          <p className="text-[11px] text-amber-600/70 mt-0.5">
            Add{' '}
            <code className="font-mono bg-amber-500/10 px-1 rounded text-amber-500/80">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{' '}
            and{' '}
            <code className="font-mono bg-amber-500/10 px-1 rounded text-amber-500/80">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{' '}
            to your environment variables.
          </p>
        </div>
      </div>
    </div>
  )
}
