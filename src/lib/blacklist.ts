import { db } from "./db";

/**
 * Auto-blacklist rule — called whenever an order becomes returned/canceled.
 * - count = orders with same phone in (returned, canceled)
 * - count >= 2 → upsert entry {phone, strikes: count, reasons}
 * - an existing entry is always re-synced to the current strikes count
 * Returns the computed strike count.
 */
export async function applyAutoBlacklist(phone: string): Promise<number> {
  const badOrders = await db.order.findMany({
    where: { phone, status: { in: ["returned", "canceled"] } },
    select: { returnReason: true, status: true },
  });
  const count = badOrders.length;
  const reasons = badOrders.map((o) => o.returnReason ?? o.status);
  const reasonsJson = JSON.stringify(reasons);

  if (count >= 2) {
    await db.blacklistEntry.upsert({
      where: { phone },
      update: { strikes: count, reasons: reasonsJson },
      create: { phone, strikes: count, reasons: reasonsJson },
    });
  } else {
    const existing = await db.blacklistEntry.findUnique({ where: { phone } });
    if (existing) {
      await db.blacklistEntry.update({
        where: { phone },
        data: { strikes: count, reasons: reasonsJson },
      });
    }
  }
  return count;
}
