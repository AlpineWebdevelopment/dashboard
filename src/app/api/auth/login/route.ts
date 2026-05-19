import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "gt_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 years

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
  const sig = b64url(sigBuffer);

  return `${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    const correct = process.env.DASHBOARD_PASSWORD;
    const secret = process.env.AUTH_SECRET;

    if (!secret) {
      return NextResponse.json({ error: "AUTH_SECRET env var not set" }, { status: 500 });
    }
    if (!correct) {
      return NextResponse.json({ error: "DASHBOARD_PASSWORD env var not set" }, { status: 500 });
    }
    if (password !== correct) {
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
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
