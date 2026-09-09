// Pricing rules: unit price + optional bundle offer (e.g. pair at a fixed total).
// Total for a quantity = full bundles at offerTotal + remainder at unit price.
// Stored on the order as: unitPriceMad × quantity − discountMad.

export interface OfferFields {
  priceMad: number;
  offerQty?: number | null;
  offerTotalMad?: number | null;
}

/** Discount (MAD) granted for a given quantity, based on the product offer. */
export function orderDiscount(
  quantity: number,
  { priceMad, offerQty, offerTotalMad }: OfferFields
): number {
  if (!offerQty || offerTotalMad == null || offerQty < 2 || quantity < offerQty) {
    return 0;
  }
  const perBundle = Math.max(0, offerQty * priceMad - offerTotalMad);
  if (perBundle <= 0) return 0;
  return Math.floor(quantity / offerQty) * perBundle;
}

/** Final order total (MAD) after discount. */
export function orderTotal(
  quantity: number,
  unitPriceMad: number,
  discountMad?: number | null
): number {
  return Math.max(0, Math.round(quantity * unitPriceMad - (discountMad ?? 0)));
}
