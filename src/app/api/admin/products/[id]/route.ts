import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { toProductDTO } from "@/lib/serialize";
import { productInputSchema, toProductColumns } from "@/lib/product-schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/products/[id] — single product. */
export async function GET(_req: Request, { params }: Params) {
  if (!(await requireAdmin())) return unauthorized();
  const { id } = await params;

  const product = await db.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
  return NextResponse.json({ product: toProductDTO(product) });
}

/** PUT /api/admin/products/[id] — update a product. */
export async function PUT(req: Request, { params }: Params) {
  if (!(await requireAdmin())) return unauthorized();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = productInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
      { status: 400 }
    );
  }

  // offer pair sanity: offerTotal must be lower than qty * price to be a real offer
  const { offerQty, offerTotalMad, priceMad } = parsed.data;
  if (offerQty && offerTotalMad != null && offerTotalMad >= offerQty * priceMad) {
    return NextResponse.json(
      { error: "ثمن العرض خاصو يكون أقل من ثمن الوحدات منفصلة" },
      { status: 400 }
    );
  }

  try {
    const product = await db.product.update({
      where: { id },
      data: toProductColumns(parsed.data),
    });
    return NextResponse.json({ product: toProductDTO(product) });
  } catch {
    return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
  }
}

/** DELETE /api/admin/products/[id] — remove a product (only when it has no orders). */
export async function DELETE(_req: Request, { params }: Params) {
  if (!(await requireAdmin())) return unauthorized();
  const { id } = await params;

  const ordersCount = await db.order.count({ where: { productId: id } });
  if (ordersCount > 0) {
    return NextResponse.json(
      { error: `ما يمكنش تحيد هاد المنتج عندو ${ordersCount} طلب — عطّلو غير (active)` },
      { status: 409 }
    );
  }

  try {
    await db.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
  }
}
