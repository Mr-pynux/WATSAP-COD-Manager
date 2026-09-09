import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { TEMPLATE_LABELS } from "@/lib/constants";
import type { TemplateDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/templates — all templates with their labels. */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const templates = await db.messageTemplate.findMany({
    orderBy: { key: "asc" },
  });

  const dtos: TemplateDTO[] = templates.map((t) => ({
    key: t.key,
    bodyAr: t.bodyAr,
    label: TEMPLATE_LABELS[t.key] ?? t.key,
  }));

  return NextResponse.json({ templates: dtos });
}

const putSchema = z.object({
  key: z.string().min(1),
  bodyAr: z.string().min(5),
});

/** PUT /api/templates — save a single template body. */
export async function PUT(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "نص القالب فارغ أو غير صالح" }, { status: 400 });
  }

  try {
    const updated = await db.messageTemplate.update({
      where: { key: parsed.data.key },
      data: { bodyAr: parsed.data.bodyAr },
    });
    return NextResponse.json({ template: { key: updated.key, bodyAr: updated.bodyAr } });
  } catch {
    return NextResponse.json({ error: "القالب غير موجود" }, { status: 404 });
  }
}
