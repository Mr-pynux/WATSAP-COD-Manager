import { NextResponse } from "next/server";
import { z } from "zod";
import { adminCookieOptions } from "@/lib/auth";
import { cookies } from "next/headers";

const schema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "البريد وكلمة السر مطلوبين" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const expectedEmail = process.env.ADMIN_EMAIL || "admin@shop.ma";
  const expectedPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (email !== expectedEmail || password !== expectedPassword) {
    return NextResponse.json({ error: "البريد أو كلمة السر غالطين" }, { status: 401 });
  }

  const store = await cookies();
  const opts = adminCookieOptions();
  store.set(opts.name, opts.value, {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: opts.maxAge,
  });

  return NextResponse.json({ ok: true });
}
