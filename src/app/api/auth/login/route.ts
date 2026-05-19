import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "gt_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 years

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

// ── Token signing ─────────────────────────────────────────────────────────────
function b64url(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64url");
}

async function signToken(secret: string): Promise<string> {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, exp: Date.now() + COOKIE_MAX_AGE * 1000 })
  ).toString("base64url");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${b64url(sigBuffer)}`;
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

    const { password } = await req.json();
    const correct = process.env.DASHBOARD_PASSWORD;
    const secret = process.env.AUTH_SECRET;

    if (!secret) return NextResponse.json({ error: "AUTH_SECRET env var not set" }, { status: 500 });
    if (!correct) return NextResponse.json({ error: "DASHBOARD_PASSWORD env var not set" }, { status: 500 });

    if (password !== correct) {
      recordFailure(ip);
      const a = attempts.get(ip);
      const remaining = MAX_ATTEMPTS - (a?.count ?? 0);
      return NextResponse.json(
        { error: remaining > 0 ? `Wrong password (${remaining} attempt${remaining === 1 ? "" : "s"} left)` : "Wrong password" },
        { status: 401 }
      );
    }

    recordSuccess(ip);
    const token = await signToken(secret);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
