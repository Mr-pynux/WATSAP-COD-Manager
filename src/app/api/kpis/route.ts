import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { toOrderDTO } from "@/lib/serialize";
import type { KpisResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(days: number): Date {
  const x = startOfDay(new Date());
  x.setDate(x.getDate() - days);
  return x;
}

/** GET /api/kpis — dashboard KPIs computed server-side (today + last 30 days). */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const today = startOfDay(new Date());
  const d30 = daysAgo(30);

  const [
    ordersToday,
    total30Raw,
    new30,
    confirmedLike30,
    delivered30,
    returned30,
    adSpend30Agg,
    followupCount,
    latestOrdersRaw,
  ] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: today } } }),
    db.order.count({ where: { createdAt: { gte: d30 } } }),
    db.order.count({ where: { createdAt: { gte: d30 }, status: "new" } }),
    db.order.count({
      where: { createdAt: { gte: d30 }, status: { in: ["confirmed", "shipped", "delivered"] } },
    }),
    db.order.findMany({
      where: { status: "delivered", deliveredAt: { gte: d30 } },
      include: { product: true, courier: true },
    }),
    db.order.findMany({
      where: { status: "returned", deliveredAt: { gte: d30 } },
      select: { courierId: true, courier: { select: { feePerReturnMad: true } } },
    }),
    db.dailyAdSpend.aggregate({
      where: { date: { gte: d30 } },
      _sum: { amountMad: true },
    }),
    db.order.count({ where: { status: { in: ["no_answer", "retry"] } } }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { product: true, courier: true },
    }),
  ]);

  // ── confirmation rate (30d, excluding new) ──
  const denomConfirm = total30Raw - new30;
  const confirmationRate30d = denomConfirm > 0 ? confirmedLike30 / denomConfirm : null;

  // ── delivered rate ──
  const deliveredCount = delivered30.length;
  const returnedCount = returned30.length;
  const deliveredRate30d =
    deliveredCount + returnedCount > 0
      ? deliveredCount / (deliveredCount + returnedCount)
      : null;

  // ── money ──
  const adSpend30d = adSpend30Agg._sum.amountMad ?? 0;
  const revenue30d = delivered30.reduce((s, o) => s + o.quantity * o.unitPriceMad, 0);
  const productCost30d = delivered30.reduce((s, o) => s + o.product.costMad * o.quantity, 0);
  const courierFees30d =
    delivered30.reduce((s, o) => s + (o.courier?.feePerDeliveryMad ?? 0), 0) +
    returned30.reduce((s, o) => s + (o.courier?.feePerReturnMad ?? 0), 0);

  const costPerDelivered30d = deliveredCount > 0 ? adSpend30d / deliveredCount : null;
  const netProfit30d = revenue30d - productCost30d - courierFees30d - adSpend30d;

  const res: KpisResponse = {
    ordersToday,
    confirmationRate30d,
    deliveredRate30d,
    costPerDelivered30d,
    revenue30d,
    netProfit30d,
    adSpend30d,
    followupCount,
    latestOrders: latestOrdersRaw.map((o) => toOrderDTO(o)),
  };

  return NextResponse.json(res);
}
