import { createClient } from "@/utils/supabase/server";
import { StoreClient } from "@/components/public/store-client";
import { MetaPixel } from "@/components/meta-pixel";
import type { ProductDTO } from "@/lib/types";

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
  name: "حذاء رياضي ShoeSpot",
  imageUrls: FALLBACK_IMAGES,
  videoUrl: null,
  description:
    "سنيكرز خفيف ومريح، صالح للاستعمال اليومي — والتوصيل فابور لجميع المدن، وكتخلص فقط ملي توصلك السلعة لباب دارك.",
  features: [],
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
  stockBySize: { "39": "5", "40": "5", "41": "5", "42": "5", "43": "5", "44": "5", "45": "5" },
};

export default async function Home() {
  let products: ProductDTO[] = [FALLBACK];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      products = data.map((row) => ({
        id: row.id,
        name: row.name,
        imageUrls: row.image_urls || [],
        videoUrl: row.video_url,
        description: row.description,
        features: row.features || [],
        priceMad: row.price_mad,
        oldPriceMad: row.old_price_mad,
        offerQty: row.offer_qty,
        offerTotalMad: row.offer_total_mad,
        costMad: row.cost_mad,
        sizes: row.sizes || [],
        colors: row.colors || [],
        active: row.active,
        stockBySize: row.stock_by_size || {},
      })) as ProductDTO[];
    }
  } catch {
    // DB not ready — fallback demo product
  }

  return (
    <>
      <StoreClient products={products} />
      <MetaPixel />
    </>
  );
}
