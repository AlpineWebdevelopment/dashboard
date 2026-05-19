import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "gt_session";

function b64urlDecode(s: string): ArrayBuffer {
  // Convert base64url → base64 → bytes
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 1) return false;

    const payloadPart = token.slice(0, dot);
    const sigPart = token.slice(dot + 1);

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sigPart),
      encoder.encode(payloadPart)
    );
    if (!valid) return false;

    // Decode payload — base64url → JSON
    const jsonStr = new TextDecoder().decode(b64urlDecode(payloadPart));
    const payload = JSON.parse(jsonStr);
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page and auth API routes through
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const secret = process.env.AUTH_SECRET ?? "";

  if (!token || !(await verifyToken(token, secret))) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)",
  ],
};
