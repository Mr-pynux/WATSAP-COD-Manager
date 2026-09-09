import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_session";
const ADMIN_PAYLOAD = "admin";

/** HMAC-SHA256("admin", SESSION_SECRET) as hex — using Web Crypto (edge-safe). */
async function expectedSignature(): Promise<string> {
  const secret = process.env.SESSION_SECRET || "dev-secret-fallback";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(ADMIN_PAYLOAD));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Protects /admin/* — redirect to /login when the cookie is missing or invalid. */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;

  if (token) {
    const expected = await expectedSignature();
    // constant-time-ish comparison on equal-length hex strings
    if (token.length === expected.length) {
      let diff = 0;
      for (let i = 0; i < token.length; i++) {
        diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
      }
      if (diff === 0) {
        return NextResponse.next();
      }
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};
