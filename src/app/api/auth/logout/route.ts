import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const store = await cookies();
  const opts = adminCookieOptions(req);
  store.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: opts.sameSite,
    ...(opts.secure ? { secure: true, partitioned: true } : {}),
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
