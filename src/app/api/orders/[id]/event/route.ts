import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  type: z.enum(["created", "whatsapp_click", "status_change"]),
  detail: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/orders/[id]/event — manual event logging (e.g. "تأكد اليوم" quick action
 * from the double-confirm tab: type=status_change, detail.note="تأكد اليوم").
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) return unauthorized();

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const order = await db.order.findUnique({ where: { id }, select: { id: true } });
  if (!order) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  const event = await db.orderEvent.create({
    data: {
      orderId: id,
      type: parsed.data.type,
      detail: parsed.data.detail ? JSON.stringify(parsed.data.detail) : null,
    },
  });

  return NextResponse.json({ event: { id: event.id, type: event.type } }, { status: 201 });
}
