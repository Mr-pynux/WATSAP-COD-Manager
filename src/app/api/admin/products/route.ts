import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { toProductDTO } from "@/lib/serialize";
import { productInputSchema, toProductColumns } from "@/lib/product-schema";
import type { ProductDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/admin/products — every product (admin panel list). */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const products = await db.product.findMany({ orderBy: { createdAt: "desc" } });
  const dtos: ProductDTO[] = products.map((p) => toProductDTO(p));
  return NextResponse.json({ products: dtos });
}

/** POST /api/admin/products — create a product. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

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

  const product = await db.product.create({ data: toProductColumns(parsed.data) });
  return NextResponse.json({ product: toProductDTO(product) }, { status: 201 });
}
