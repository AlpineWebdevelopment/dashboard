export const dynamic = 'force-dynamic'

import { getCalendarsByFolder, getCalendars, getFolders, getFolder, getEntriesForCalendars } from '@/lib/actions'
import SetupBanner from '@/components/SetupBanner'
import NewCalendarButton from '@/components/NewCalendarButton'
import NewFolderButton from '@/components/NewFolderButton'
import FolderHeader from '@/components/FolderHeader'
import CalendarsList from '@/components/CalendarsList'
import CalendarMiniCard from '@/components/CalendarMiniCard'
import Link from 'next/link'
import { CalendarDays, ChevronLeft, FolderOpen } from 'lucide-react'

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

  if (folderId) {
    const [calendars, currentFolder] = await Promise.all([
      getCalendarsByFolder(folderId),
      getFolder(folderId),
    ])
    if (!currentFolder) return null

    return (
      <div className="min-h-screen">
        {!supabaseConfigured && <SetupBanner />}
        <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16 max-w-3xl">
          <Link
            href="/calendars"
            className="inline-flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors mb-6 sm:mb-8"
          >
            <ChevronLeft size={13} />
            Calendars
          </Link>

          <FolderHeader folder={currentFolder} />

          <div className="flex items-center justify-between mb-6">
            <p className="text-[11px] text-zinc-400 dark:text-zinc-700">
              {calendars.length} calendar{calendars.length !== 1 ? 's' : ''} in this folder
            </p>
            {supabaseConfigured && <NewCalendarButton folderId={folderId} />}
          </div>

          <CalendarsList calendars={calendars} folders={[]} folderId={folderId} />
        </div>
      </div>
    )
  }

  // Root view: all calendars + folders
  const [calendars, folders] = await Promise.all([
    getCalendars(),
    getFolders('calendars'),
  ])

  const entriesMap = calendars.length > 0
    ? await getEntriesForCalendars(calendars.map((c) => c.id))
    : {}

  const isEmpty = calendars.length === 0 && folders.length === 0

  return (
    <div className="min-h-screen">
      {!supabaseConfigured && <SetupBanner />}

      <div className="px-4 sm:px-8 pt-8 sm:pt-10 pb-16">
        <div className="flex items-start sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-600 mb-2 sm:mb-3">
              Tracking
            </p>
            <h1 className="text-2xl sm:text-[28px] font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
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

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 sm:py-28 rounded-2xl border border-dashed border-zinc-200/60 dark:border-white/[0.06]">
            <div className="w-11 h-11 rounded-xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] flex items-center justify-center mb-4">
              <CalendarDays size={16} className="text-zinc-400 dark:text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 mb-1">
              {supabaseConfigured ? 'No calendars yet' : 'Supabase not connected'}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-700">
              {supabaseConfigured
                ? 'Create a calendar to start tracking daily habits'
                : 'Add env vars to start saving'}
            </p>
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.length > 0 && (
              <div className="mb-8">
                <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-700 mb-3">Folders</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {folders.map((folder) => (
                    <Link
                      key={folder.id}
                      href={`/calendars?folder=${folder.id}`}
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-zinc-100 dark:hover:bg-white/[0.05] hover:border-zinc-300 dark:hover:border-white/[0.09] transition-all group"
                    >
                      <FolderOpen size={13} className="text-zinc-400 dark:text-zinc-600 group-hover:text-amber-400/70 shrink-0 transition-colors" />
                      <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200 transition-colors truncate">
                        {folder.name}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Calendars grid — side by side mini cards */}
            {calendars.length > 0 && (
              <>
                {folders.length > 0 && (
                  <p className="text-[11px] font-medium tracking-widest uppercase text-zinc-400 dark:text-zinc-700 mb-3">Calendars</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {calendars.map((cal) => (
                    <CalendarMiniCard
                      key={cal.id}
                      calendar={cal}
                      entries={entriesMap[cal.id] ?? []}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
