import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderTotal } from "@/lib/pricing";
import { requireAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface ProductPnlDTO {
  productId: string;
  productName: string;
  deliveredCount: number;
  returnedCount: number;
  revenueMad: number;
  productCostMad: number;
  courierFeesMad: number;
  adSpendMad: number;
  ordersShare: number; // 0..1
  netMad: number;
}

export interface PnlResponse {
  products: ProductPnlDTO[];
  adSpend30d: number;
  totalOrders30d: number;
  summary: {
    revenueMad: number;
    totalCostsMad: number;
    netMad: number;
    productCostMad: number;
    courierFeesMad: number;
  };
}

/** GET /api/finance — per-product P&L over the last 30 days. */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const d30 = new Date();
  d30.setDate(d30.getDate() - 30);
  d30.setHours(0, 0, 0, 0);

  const [products, delivered, returned, orders30, adSpendAgg] = await Promise.all([
    db.product.findMany(),
    db.order.findMany({
      where: { status: "delivered", deliveredAt: { gte: d30 } },
      include: { product: true, courier: true },
    }),
    db.order.findMany({
      where: { status: "returned", deliveredAt: { gte: d30 } },
      include: { product: true, courier: true },
    }),
    db.order.findMany({
      where: { createdAt: { gte: d30 } },
      select: { productId: true },
    }),
    db.dailyAdSpend.aggregate({
      where: { date: { gte: d30 } },
      _sum: { amountMad: true },
    }),
  ]);

  const adSpend30d = adSpendAgg._sum.amountMad ?? 0;
  const totalOrders30d = orders30.length;

  const rows: ProductPnlDTO[] = products.map((p) => {
    const del = delivered.filter((o) => o.productId === p.id);
    const ret = returned.filter((o) => o.productId === p.id);
    const productOrders = orders30.filter((o) => o.productId === p.id).length;

    const revenueMad = del.reduce(
      (s, o) => s + orderTotal(o.quantity, o.unitPriceMad, o.discountMad),
      0
    );
    const productCostMad = del.reduce((s, o) => s + o.product.costMad * o.quantity, 0);
    const courierFeesMad =
      del.reduce((s, o) => s + (o.courier?.feePerDeliveryMad ?? 0), 0) +
      ret.reduce((s, o) => s + (o.courier?.feePerReturnMad ?? 0), 0);

    // ad spend allocation: total ad spend × (product orders / total orders)
    const ordersShare = totalOrders30d > 0 ? productOrders / totalOrders30d : 0;
    const adSpendMad = adSpend30d * ordersShare;

    return {
      productId: p.id,
      productName: p.name,
      deliveredCount: del.length,
      returnedCount: ret.length,
      revenueMad,
      productCostMad,
      courierFeesMad,
      adSpendMad,
      ordersShare,
      netMad: revenueMad - productCostMad - courierFeesMad - adSpendMad,
    };
  });

  const summaryRevenue = rows.reduce((s, r) => s + r.revenueMad, 0);
  const summaryProductCost = rows.reduce((s, r) => s + r.productCostMad, 0);
  const summaryCourierFees = rows.reduce((s, r) => s + r.courierFeesMad, 0);
  const summaryTotalCosts = summaryProductCost + summaryCourierFees + adSpend30d;

  const res: PnlResponse = {
    products: rows,
    adSpend30d,
    totalOrders30d,
    summary: {
      revenueMad: summaryRevenue,
      totalCostsMad: summaryTotalCosts,
      netMad: summaryRevenue - summaryTotalCosts,
      productCostMad: summaryProductCost,
      courierFeesMad: summaryCourierFees,
    },
  };

  return NextResponse.json(res);
}
