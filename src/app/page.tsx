import { db } from "@/lib/db";
import { toProductDTO } from "@/lib/serialize";
import { LandingClient } from "@/components/public/landing-client";
import { MetaPixel } from "@/components/meta-pixel";
import type { ProductDTO } from "@/lib/types";
import type { Product } from "@prisma/client";

export const dynamic = "force-dynamic";

const FALLBACK_IMAGES = [
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/16e2e26e2d2f.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0ebaa6145dcb.jpeg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/60716d5bb2e0.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6fdca56479ce.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b7f0de266de9.png",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8fa13a4e54cc.jpg",
];

const FALLBACK: ProductDTO = {
  id: "",
  name: "حذاء رياضي Urban Step",
  imageUrls: FALLBACK_IMAGES,
  priceMad: 150,
  oldPriceMad: null,
  offerQty: 2,
  offerTotalMad: 220,
  costMad: 85,
  sizes: ["39", "40", "41", "42", "43", "44", "45"],
  colors: [
    { name: "أبيض", hex: "#f5f5f4" },
    { name: "أسود", hex: "#1c1917" },
    { name: "بيج", hex: "#d6c8b5" },
  ],
  active: true,
};

function toDto(p: Product): ProductDTO {
  return toProductDTO(p);
}

export default async function Home() {
  let product: ProductDTO = FALLBACK;
  try {
    const found = await db.product.findFirst({ where: { active: true } });
    if (found) product = toDto(found);
  } catch {
    // DB not ready — fallback demo product
  }

  return (
    <>
      <LandingClient product={product} />
      <MetaPixel />
    </>
  );
}
