import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE = "admin_session";
export const ADMIN_PAYLOAD = "admin";

function getSecret(): string {
  return process.env.SESSION_SECRET || "dev-secret-fallback";
}

/** HMAC-SHA256 hex signature of the "admin" payload using SESSION_SECRET. */
export function signAdmin(): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(ADMIN_PAYLOAD)
    .digest("hex");
}

/** Constant-time compare of two hex strings. */
export function verifyAdminSignature(signature: string | undefined | null): boolean {
  if (!signature) return false;
  const expected = signAdmin();
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Route-handler guard: reads cookie + verifies HMAC. Returns true when admin. */
export async function requireAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  return verifyAdminSignature(token);
}

/** Helper to build a 401 JSON response. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
}

/** Cookie options for the admin session. */
export function adminCookieOptions() {
  return {
    name: ADMIN_COOKIE,
    value: signAdmin(),
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
