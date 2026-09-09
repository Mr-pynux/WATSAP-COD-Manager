import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { pickTemplateKey, render, formatTotal } from "@/lib/whatsapp";
import { waLink } from "@/lib/phone";

export const dynamic = "force-dynamic";

const schema = z.object({
  orderId: z.string().min(1),
  templateKey: z.string().min(1).optional(),
});

/**
 * POST /api/whatsapp {orderId, templateKey?}
 * - picks/uses template, renders vars, builds wa.me URL
 * - logs OrderEvent "whatsapp_click" {templateKey}
 * - increments attempts, sets lastAttemptAt=now
 * - no_answer → retry
 * Returns {url}; client opens it in a new tab.
 */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

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
  const { orderId, templateKey } = parsed.data;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { product: true },
  });
  if (!order) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  const chosenKey = templateKey || pickTemplateKey(order);
  const template = await db.messageTemplate.findUnique({ where: { key: chosenKey } });
  if (!template) {
    return NextResponse.json({ error: "القالب غير موجود" }, { status: 404 });
  }

  const message = render(template.bodyAr, {
    name: order.customerName,
    product: order.product.name,
    size: order.size,
    color: order.color ?? undefined,
    quantity: order.quantity,
    total: formatTotal(order.quantity, order.unitPriceMad, order.discountMad),
    city: order.city,
    tracking: order.tracking ?? undefined,
  });

  const now = new Date();
  await db.order.update({
    where: { id: order.id },
    data: {
      attempts: { increment: 1 },
      lastAttemptAt: now,
      ...(order.status === "no_answer" ? { status: "retry" } : {}),
    },
  });

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: "whatsapp_click",
      detail: JSON.stringify({ templateKey: chosenKey }),
    },
  });

  return NextResponse.json({ url: waLink(order.phone, message), templateKey: chosenKey });
}
