import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { changeOrderStatus } from "@/lib/orders-service";
import { toOrderDTO } from "@/lib/serialize";
import { ORDER_STATUSES, RETURN_REASONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z
    .string()
    .refine((s) => ORDER_STATUSES.includes(s as (typeof ORDER_STATUSES)[number]))
    .optional(),
  returnReason: z
    .string()
    .nullable()
    .refine((v) => v === null || RETURN_REASONS.includes(v as (typeof RETURN_REASONS)[number]))
    .optional(),
  courierId: z.string().nullable().optional(),
  tracking: z.string().trim().nullable().optional(),
  shipDate: z.string().nullable().optional(), // yyyy-MM-dd
  notes: z.string().trim().nullable().optional(),
});

export async function PATCH(
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await db.order.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  // Status path (with events + timestamps + blacklist rule)
  if (data.status && data.status !== existing.status) {
    await changeOrderStatus(id, data.status, {
      returnReason: data.returnReason ?? undefined,
    });
  } else if (data.returnReason !== undefined) {
    await db.order.update({ where: { id }, data: { returnReason: data.returnReason } });
  }

  // Non-status fields
  const patch: Record<string, unknown> = {};
  if (data.courierId !== undefined) patch.courierId = data.courierId || null;
  if (data.tracking !== undefined) patch.tracking = data.tracking || null;
  if (data.notes !== undefined) patch.notes = data.notes || null;
  if (data.shipDate !== undefined) {
    if (data.shipDate && !Number.isNaN(new Date(`${data.shipDate}T00:00:00`).getTime())) {
      patch.shipDate = new Date(`${data.shipDate}T00:00:00`);
    } else {
      patch.shipDate = null;
    }
  }
  if (Object.keys(patch).length > 0) {
    await db.order.update({ where: { id }, data: patch });
  }

  const updated = await db.order.findUnique({
    where: { id },
    include: { product: true, courier: true },
  });
  if (!updated) {
    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ order: toOrderDTO(updated) });
}
