import { z } from "zod";
import { normalizeMediaUrl } from "@/lib/url";

/** Seller-pasted image URL: auto-fix (trim + prepend https://) instead of rejecting. */
const imageField = z.preprocess(
  (v) => (typeof v === "string" ? normalizeMediaUrl(v) ?? "رابط غير صالح" : v),
  z.string().url("رابط صورة غير صالح")
);

/** Seller-pasted video URL (MP4 أو يوتيوب) — empty becomes null. */
const videoField = z.preprocess(
  (v) => {
    if (v == null || v === "") return null;
    return typeof v === "string" ? normalizeMediaUrl(v) ?? "رابط غير صالح" : v;
  },
  z.string().url("رابط الفيديو غير صالح").nullable()
);

/** Payload schema shared by create + update product endpoints. */
export const productInputSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير"),
  imageUrls: z.array(imageField).default([]),
  videoUrl: videoField,
  description: z.string().trim().max(2000).nullable().optional(),
  features: z.array(z.string().trim().min(1).max(120)).max(10).optional(),
  priceMad: z.number().min(0, "الثمن غير صحيح"),
  oldPriceMad: z.number().positive().nullable().optional(),
  offerQty: z.number().int().min(2).max(10).nullable().optional(),
  offerTotalMad: z.number().positive().nullable().optional(),
  costMad: z.number().min(0).optional(),
  sizes: z.array(z.string().trim()).default([]),
  colors: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(30),
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح"),
      })
    )
    .default([]),
  active: z.boolean().optional(),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** Serialize validated input into Prisma columns (JSON strings). */
export function toProductColumns(input: ProductInput) {
  return {
    name: input.name,
    imageUrls: JSON.stringify(input.imageUrls),
    videoUrl: input.videoUrl ?? null,
    description: input.description || null,
    features: JSON.stringify(input.features ?? []),
    priceMad: input.priceMad,
    oldPriceMad: input.oldPriceMad ?? null,
    offerQty: input.offerQty ?? null,
    offerTotalMad: input.offerTotalMad ?? null,
    costMad: input.costMad ?? 0,
    sizes: JSON.stringify(input.sizes),
    colors: JSON.stringify(input.colors),
    active: input.active ?? true,
  };
}
