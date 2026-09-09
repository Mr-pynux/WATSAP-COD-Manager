import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { normalizeMaPhone } from "@/lib/phone";
import { parseJsonArray } from "@/lib/serialize";
import type { BlacklistEntryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/blacklist — list entries (most strikes first). */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const entries = await db.blacklistEntry.findMany({
    orderBy: [{ strikes: "desc" }, { createdAt: "desc" }],
  });

  const dtos: BlacklistEntryDTO[] = entries.map((e) => ({
    id: e.id,
    phone: e.phone,
    strikes: e.strikes,
    reasons: parseJsonArray<string>(e.reasons),
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({ entries: dtos });
}

const addSchema = z.object({
  phone: z.string().min(9),
  reason: z.string().trim().optional().default("يدوي"),
});

/** POST /api/blacklist — manual add (phone + optional reason). */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const phone = normalizeMaPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 });
  }

  const existing = await db.blacklistEntry.findUnique({ where: { phone } });
  const reasons = existing
    ? [...parseJsonArray<string>(existing.reasons), parsed.data.reason]
    : [parsed.data.reason];

  const entry = await db.blacklistEntry.upsert({
    where: { phone },
    update: { strikes: { increment: 1 }, reasons: JSON.stringify(reasons) },
    create: { phone, strikes: 1, reasons: JSON.stringify(reasons) },
  });

  return NextResponse.json({ entry: { ...entry, reasons } }, { status: 201 });
}
