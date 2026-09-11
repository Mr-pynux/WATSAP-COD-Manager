import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProductDTO } from "@/lib/serialize";
import type { ProductDTO } from "@/lib/types";

/** Public: active products for the landing page. */
export async function GET() {
  const products = await db.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  const dtos: ProductDTO[] = products.map((p) => toProductDTO(p));

  return NextResponse.json({ products: dtos });
}
