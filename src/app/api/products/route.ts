import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/serialize";
import type { ProductDTO } from "@/lib/types";

/** Public: active products for the landing page. */
export async function GET() {
  const products = await db.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  const dtos: ProductDTO[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrls: parseJsonArray<string>(p.imageUrls),
    priceMad: p.priceMad,
    oldPriceMad: p.oldPriceMad ?? null,
    costMad: p.costMad,
    sizes: parseJsonArray<string>(p.sizes),
    colors: parseJsonArray<{ name: string; hex: string }>(p.colors),
    active: p.active,
  }));

  return NextResponse.json({ products: dtos });
}
