import { NextRequest, NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";
import { canAccessPath, homePathFor } from "@/lib/users";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page, auth API routes, personal bot API, and public share pages
  // through. The two Google endpoints are called by Google and by the cron
  // scheduler, neither of which carries a session cookie — they authenticate
  // themselves with the channel token and CRON_SECRET respectively.
  //
  // /api/atrium is the booking calendar: a stranger on an Atrium landing page
  // reads the free slots and posts a booking back, so a session cookie is the
  // one thing they cannot have. Those two routes guard themselves — an origin
  // allowlist (lib/crm/cors.ts), a rate limit, and server-side validation of
  // the slot before anything is written.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/personal/") ||
    pathname.startsWith("/api/google/webhook") ||
    pathname.startsWith("/api/google/cron") ||
    pathname.startsWith("/api/atrium/") ||
    pathname.startsWith("/share/")
  ) {
    return NextResponse.next();
  }

  const account = await readSession(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET
  );

  if (!account) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // Signed in, but not for this. A redirect rather than a 403 so a stray link
  // or a bookmarked page lands somewhere useful instead of on an error — the
  // sidebar never offers these routes to a restricted account in the first
  // place, so getting here is either a typo or a probe.
  if (!canAccessPath(account.role, pathname)) {
    const home = req.nextUrl.clone();
    home.pathname = homePathFor(account.role);
    home.search = "";
    return NextResponse.redirect(home);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.png|.*\.jpg|.*\.svg|.*\.ico).*)",
  ],
};
