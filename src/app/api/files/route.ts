// Listing the files on one record.
//
// The card fetches this on mount rather than being handed a list as a prop.
// Two of its three homes are server components that could have loaded it, but
// the third is the MRR client modal, which opens in the browser long after its
// page was rendered — so one self-loading card beats a prop threaded through
// three parents plus a second code path for the modal. Same reason
// BackgroundControls reads its bucket on mount.
//
// Metadata only. The bytes are at /api/files/[id], one file at a time.

import { NextResponse, type NextRequest } from 'next/server'
import { currentAccount } from '@/lib/auth-server'
import { listAttachments } from '@/lib/attachments'
import type { AttachmentOwner } from '@/lib/attachment-types'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KINDS = ['lead', 'client', 'project'] as const

export async function GET(req: NextRequest) {
  const account = await currentAccount()
  if (!account) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const kind = req.nextUrl.searchParams.get('ownerKind')
  const id = req.nextUrl.searchParams.get('ownerId')

  if (!kind || !KINDS.includes(kind as (typeof KINDS)[number]) || !id || !UUID.test(id)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  // Same rule as the download route: the co-worker account reads client-project
  // files, and nothing else. Their sidebar never offers the other two, so
  // reaching here with one is a probe rather than a mistake.
  if (kind !== 'project' && account.role !== 'admin') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const owner = { kind, id } as AttachmentOwner
  return NextResponse.json(await listAttachments(owner))
}
