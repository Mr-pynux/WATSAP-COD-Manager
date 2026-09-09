import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/finance/adspend — last 14 days of ad spend. */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const entries = await db.dailyAdSpend.findMany({
    orderBy: { date: "desc" },
    take: 14,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      date: e.date.toISOString().slice(0, 10),
      amountMad: e.amountMad,
    })),
  });
}

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ خاصو يكون yyyy-MM-dd"),
  amountMad: z.number().min(0),
});

/** POST /api/finance/adspend — upsert one day's ad spend. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const date = new Date(`${parsed.data.date}T00:00:00`);

  const entry = await db.dailyAdSpend.upsert({
    where: { date },
    update: { amountMad: parsed.data.amountMad },
    create: { date, amountMad: parsed.data.amountMad },
  });

  return NextResponse.json({
    entry: { date: entry.date.toISOString().slice(0, 10), amountMad: entry.amountMad },
  });
}
