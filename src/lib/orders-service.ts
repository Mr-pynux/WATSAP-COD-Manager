import { db } from "./db";
import { applyAutoBlacklist } from "./blacklist";
import type { Order } from "@prisma/client";

export interface StatusChangeResult {
  order: Order;
  strikes: number | null;
}

/**
 * Change an order status with side effects:
 * - timestamps: confirmed→confirmedAt, shipped→shippedAt, delivered→deliveredAt
 * - logs a status_change OrderEvent {from,to}
 * - auto-blacklist check when it becomes returned/canceled
 * Returns updated order + strike count when the blacklist rule ran.
 */
export async function changeOrderStatus(
  orderId: string,
  newStatus: string,
  extra?: { returnReason?: string | null }
): Promise<StatusChangeResult | null> {
  const current = await db.order.findUnique({ where: { id: orderId } });
  if (!current) return null;
  if (current.status === newStatus && !extra) return { order: current, strikes: null };

  const now = new Date();
  const patch: Record<string, unknown> = { status: newStatus };

  if (newStatus === "confirmed") patch.confirmedAt = current.confirmedAt ?? now;
  if (newStatus === "shipped") patch.shippedAt = current.shippedAt ?? now;
  if (newStatus === "delivered") patch.deliveredAt = current.deliveredAt ?? now;
  if (extra?.returnReason !== undefined) patch.returnReason = extra.returnReason;

  const order = await db.order.update({ where: { id: orderId }, data: patch });

  if (current.status !== newStatus) {
    await db.orderEvent.create({
      data: {
        orderId,
        type: "status_change",
        detail: JSON.stringify({ from: current.status, to: newStatus }),
      },
    });
  }

  let strikes: number | null = null;
  if (newStatus === "returned" || newStatus === "canceled") {
    strikes = await applyAutoBlacklist(order.phone);
  }

  return { order, strikes };
}
