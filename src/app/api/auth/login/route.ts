import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "gt_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function signToken(secret: string): Promise<string> {
  const payload = btoa(
    JSON.stringify({ v: 1, exp: Date.now() + COOKIE_MAX_AGE * 1000 })
  );

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  const correct = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.AUTH_SECRET ?? "";

  if (!correct || password !== correct) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

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
}
