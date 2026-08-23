import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { passwordFor } from "@/lib/passwords";
import { findAccount, homePathFor } from "@/lib/users";

// ── Brute-force lockout (in-memory, per IP) ──────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

interface Attempt { count: number; lockedUntil: number }
const attempts = new Map<string, Attempt>();

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkLockout(ip: string): { blocked: boolean; retryAfterSec?: number } {
  const a = attempts.get(ip);
  if (!a) return { blocked: false };
  if (a.lockedUntil > Date.now()) {
    return { blocked: true, retryAfterSec: Math.ceil((a.lockedUntil - Date.now()) / 1000) };
  }
  return { blocked: false };
}

function recordFailure(ip: string) {
  const a = attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) {
    a.lockedUntil = Date.now() + LOCKOUT_MS;
    a.count = 0; // reset counter after lockout starts
  }
  attempts.set(ip, a);
}

function recordSuccess(ip: string) {
  attempts.delete(ip);
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    const lockout = checkLockout(ip);

    if (lockout.blocked) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${Math.ceil((lockout.retryAfterSec ?? 900) / 60)} min.` },
        { status: 429 }
      );
    }

    const { username, password } = await req.json();
    const secret = process.env.AUTH_SECRET;
    if (!secret) return NextResponse.json({ error: "AUTH_SECRET env var not set" }, { status: 500 });

    const account = findAccount(typeof username === "string" ? username : null);
    const expected = account ? passwordFor(account) : undefined;

    // An unknown username is only reported once the password is also checked,
    // and with the same message either way — otherwise the form doubles as a
    // way to enumerate who has an account here.
    if (account && !expected) {
      return NextResponse.json(
        { error: `No password configured for ${account.username}` },
        { status: 500 }
      );
    }

    if (!account || password !== expected) {
      recordFailure(ip);
      const a = attempts.get(ip);
      const remaining = MAX_ATTEMPTS - (a?.count ?? 0);
      return NextResponse.json(
        {
          error:
            remaining > 0 && remaining < MAX_ATTEMPTS
              ? `Wrong username or password (${remaining} attempt${remaining === 1 ? "" : "s"} left)`
              : "Wrong username or password",
        },
        { status: 401 }
      );
    }

    recordSuccess(ip);
    const token = await signSession(account.username, secret);

    // The browser redirects here rather than always to `/` — a co-worker
    // account has no overview page to land on.
    const res = NextResponse.json({ ok: true, redirect: homePathFor(account.role) });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
