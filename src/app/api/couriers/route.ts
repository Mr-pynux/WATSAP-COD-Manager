import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface CourierStatsDTO {
  id: string;
  name: string;
  contact: string | null;
  feePerDeliveryMad: number;
  feePerReturnMad: number;
  deliveredCount: number;
  returnedCount: number;
  returnRate: number | null;
}

/** GET /api/couriers — couriers + delivery stats. */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const couriers = await db.courier.findMany({ orderBy: { name: "asc" } });

  const stats = await Promise.all(
    couriers.map(async (c) => {
      const [delivered, returned] = await Promise.all([
        db.order.count({ where: { courierId: c.id, status: "delivered" } }),
        db.order.count({ where: { courierId: c.id, status: "returned" } }),
      ]);
      const dto: CourierStatsDTO = {
        id: c.id,
        name: c.name,
        contact: c.contact,
        feePerDeliveryMad: c.feePerDeliveryMad,
        feePerReturnMad: c.feePerReturnMad,
        deliveredCount: delivered,
        returnedCount: returned,
        returnRate: delivered + returned > 0 ? returned / (delivered + returned) : null,
      };
      return dto;
    })
  );

  return NextResponse.json({ couriers: stats });
}

const createSchema = z.object({
  name: z.string().trim().min(2),
  contact: z.string().trim().optional().nullable(),
  feePerDeliveryMad: z.number().min(0),
  feePerReturnMad: z.number().min(0),
});

/** POST /api/couriers — add courier. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const courier = await db.courier.create({ data: parsed.data });
  return NextResponse.json({ courier }, { status: 201 });
}
