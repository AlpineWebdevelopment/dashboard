export const dynamic = 'force-dynamic'

import { getCalendarsByFolder, getFolders, getFolder } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import NewCalendarButton from '@/components/NewCalendarButton'
import NewFolderButton from '@/components/NewFolderButton'
import FolderHeader from '@/components/FolderHeader'
import CalendarsList from '@/components/CalendarsList'
import Link from 'next/link'
import { CalendarDays, ChevronLeft } from 'lucide-react'

const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function CalendarsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { folder: folderParam } = await searchParams
  const folderId = typeof folderParam === 'string' ? folderParam : null

  const [calendars, folders, currentFolder] = await Promise.all([
    getCalendarsByFolder(folderId),
    folderId ? Promise.resolve([]) : getFolders('calendars'),
    folderId ? getFolder(folderId) : Promise.resolve(null),
  ])

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
        {folderId && currentFolder ? (
          <>
            <Link
              href="/calendars"
              className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-6 sm:mb-8"
            >
              <ChevronLeft size={13} />
              Calendars
            </Link>

            <FolderHeader folder={currentFolder} />

            <div className="flex items-center justify-between mb-6">
              <p className="text-[11px] text-zinc-700">
                {calendars.length} calendar{calendars.length !== 1 ? 's' : ''} in this folder
              </p>
              {supabaseConfigured && <NewCalendarButton folderId={folderId} />}
            </div>

            <CalendarsList calendars={calendars} folders={[]} folderId={folderId} />
          </>
        ) : (
          <>
            <div className="flex items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
              <div>
                <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-600 mb-2 sm:mb-3">
                  Tracking
                </p>
                <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-100 tracking-tight leading-tight">
                  Calendars
                </h1>
              </div>
              {supabaseConfigured && (
                <div className="flex items-center gap-2 shrink-0">
                  <NewFolderButton type="calendars" />
                  <NewCalendarButton />
                </div>
              )}
            </div>

            {calendars.length === 0 && folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 sm:py-28 rounded-2xl border border-dashed border-white/[0.06]">
                <div className="w-11 h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4">
                  <CalendarDays size={16} className="text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500 mb-1">
                  {supabaseConfigured ? 'No calendars yet' : 'Supabase not connected'}
                </p>
                <p className="text-xs text-zinc-700">
                  {supabaseConfigured
                    ? 'Create a calendar to start tracking daily habits'
                    : 'Add env vars to start saving'}
                </p>
              </div>
            ) : (
              <CalendarsList calendars={calendars} folders={folders} folderId={null} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
