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

/** Detect a secure (HTTPS) context — via proxy headers or request URL.
 *  Needed so the admin cookie works through HTTPS preview links / iframes. */
export function isSecureRequest(req?: Request): boolean {
  if (!req) return false;
  const fwdProto = req.headers.get("x-forwarded-proto");
  if (fwdProto) return fwdProto.split(",")[0].trim().toLowerCase() === "https";
  if (req.headers.get("x-forwarded-ssl")?.toLowerCase() === "on") return true;
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Cookie options for the admin session.
 *  HTTPS: SameSite=None + Secure (+Partitioned) so the cookie survives
 *  third-party iframe previews. HTTP dev: SameSite=Lax. */
export function adminCookieOptions(req?: Request) {
  const secure = isSecureRequest(req);
  return {
    name: ADMIN_COOKIE,
    value: signAdmin(),
    httpOnly: true as const,
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    ...(secure ? { partitioned: true } : {}),
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
