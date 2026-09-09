import type { Order, Product, Courier } from "@prisma/client";
import type { OrderDTO, ProductDTO } from "./types";

type OrderWithRelations = Order & {
  product: Pick<Product, "id" | "name" | "costMad">;
  courier: Courier | null;
};

export function toOrderDTO(o: OrderWithRelations): OrderDTO {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    phone: o.phone,
    city: o.city,
    district: o.district,
    landmark: o.landmark,
    productId: o.productId,
    product: {
      id: o.product.id,
      name: o.product.name,
      costMad: o.product.costMad,
    },
    size: o.size,
    color: o.color,
    quantity: o.quantity,
    unitPriceMad: o.unitPriceMad,
    totalMad: o.quantity * o.unitPriceMad,
    status: o.status,
    attempts: o.attempts,
    lastAttemptAt: o.lastAttemptAt ? o.lastAttemptAt.toISOString() : null,
    shipDate: o.shipDate ? o.shipDate.toISOString() : null,
    courierId: o.courierId,
    courier: o.courier ? { id: o.courier.id, name: o.courier.name } : null,
    tracking: o.tracking,
    notes: o.notes,
    returnReason: o.returnReason,
    createdAt: o.createdAt.toISOString(),
    confirmedAt: o.confirmedAt ? o.confirmedAt.toISOString() : null,
    shippedAt: o.shippedAt ? o.shippedAt.toISOString() : null,
    deliveredAt: o.deliveredAt ? o.deliveredAt.toISOString() : null,
  };
}

export function parseJsonArray<T>(raw: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function toProductDTO(
  p: Product & object
): ProductDTO {
  return {
    id: p.id,
    name: p.name,
    imageUrls: parseJsonArray<string>(p.imageUrls),
    priceMad: p.priceMad,
    oldPriceMad: p.oldPriceMad ?? null,
    costMad: p.costMad,
    sizes: parseJsonArray<string>(p.sizes),
    colors: parseJsonArray<{ name: string; hex: string }>(p.colors),
    active: p.active,
  };
}
