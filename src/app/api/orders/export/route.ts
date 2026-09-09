import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderTotal } from "@/lib/pricing";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { buildOrdersCsv, csvFilename } from "@/lib/csv";
import { parseOrdersFilters, buildOrdersWhere } from "@/lib/orders-query";
import { STATUS_LABELS, type OrderStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * CSV export for couriers.
 * - ?ids=a,b,c → export exactly those orders
 * - otherwise  → export the current filtered set (all pages)
 * Response: text/csv; charset=utf-8 with BOM + CRLF, filename orders-{date}.csv
 */
export async function GET(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");

  let orders;
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    orders = ids.length
      ? await db.order.findMany({
          where: { id: { in: ids } },
          orderBy: { createdAt: "desc" },
          include: { product: true, courier: true },
        })
      : [];
  } else {
    const where = buildOrdersWhere(parseOrdersFilters(url.searchParams));
    orders = await db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { product: true, courier: true },
    });
  }

  const csv = buildOrdersCsv(
    orders.map((o) => ({
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      phone: o.phone,
      city: o.city,
      district: o.district,
      landmark: o.landmark,
      productName: o.product.name,
      size: o.size,
      color: o.color,
      quantity: o.quantity,
      totalMad: orderTotal(o.quantity, o.unitPriceMad, o.discountMad),
      notes: o.notes,
      statusLabel: STATUS_LABELS[o.status as OrderStatus] ?? o.status,
      createdAt: o.createdAt,
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename()}"`,
      "Cache-Control": "no-store",
    },
  });
}
