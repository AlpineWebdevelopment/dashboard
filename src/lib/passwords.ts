// The passwords, kept apart from the roster in `lib/users`.
//
// `lib/users` is reachable from the browser bundle — `lib/nav` imports its
// access helpers, and `lib/nav` is imported by the sidebar — so anything in it
// ships to the client. This module is imported by the login route and by
// nothing else, which is what keeps these two lookups on the server.
//
// No password is written down here. Every one of them is an environment
// variable, so a checkout of this repo carries no way into the dashboard.

import type { Account } from './users'

/**
 * The password for an account, or undefined when its env var is unset — which
 * the login route reports as a configuration error rather than a bad password,
 * so a missing variable does not read as "you typed it wrong".
 *
 * `granturismo` keeps DASHBOARD_PASSWORD: it is the password that already
 * existed, and rotating it would sign us out for no reason.
 */
export function passwordFor(account: Account): string | undefined {
  switch (account.username) {
    case 'granturismo':
      return process.env.DASHBOARD_PASSWORD
    case 'splexz':
      return process.env.SPLEXZ_PASS
    default:
      return undefined
  }
}
