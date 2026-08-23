// The signed-in account, read from the request's cookies.
//
// Separate from `lib/session` because `next/headers` only exists in the server
// component graph — the proxy runs on the edge and imports the crypto half of
// that module directly.

import { cookies } from 'next/headers'
import { readSession, SESSION_COOKIE } from './session'
import type { Account } from './users'

export async function currentAccount(): Promise<Account | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return readSession(token, process.env.AUTH_SECRET)
}
