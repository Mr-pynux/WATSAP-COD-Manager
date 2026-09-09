import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  contact: z.string().trim().nullable().optional(),
  feePerDeliveryMad: z.number().min(0).optional(),
  feePerReturnMad: z.number().min(0).optional(),
});

/** PATCH /api/couriers/[id] — update fees / name / contact. */
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

  try {
    const courier = await db.courier.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ courier });
  } catch {
    return NextResponse.json({ error: "الناقل غير موجود" }, { status: 404 });
  }
}
