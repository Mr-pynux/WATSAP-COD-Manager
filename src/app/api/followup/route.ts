import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { toOrderDTO } from "@/lib/serialize";
import { pickTemplateKey } from "@/lib/whatsapp";
import type { OrderDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface FollowupResponse {
  queue: OrderDTO[]; // status no_answer|retry, sorted lastAttemptAt asc
  doubleConfirm: OrderDTO[]; // confirmed with shipDate = tomorrow
}

/** GET /api/followup — follow-up queue + double-confirm lists. */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const startOfTomorrow = new Date();
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  startOfTomorrow.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfTomorrow);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  const [queueRaw, doubleRaw] = await Promise.all([
    db.order.findMany({
      where: { status: { in: ["no_answer", "retry"] } },
      orderBy: { lastAttemptAt: "asc" },
      include: { product: true, courier: true },
    }),
    db.order.findMany({
      where: {
        status: "confirmed",
        shipDate: { gte: startOfTomorrow, lt: endOfTomorrow },
      },
      orderBy: { shipDate: "asc" },
      include: { product: true, courier: true },
    }),
  ]);

  const queue = queueRaw.map((o) => toOrderDTO(o));
  const doubleConfirm = doubleRaw.map((o) => toOrderDTO(o));

  // annotate chosen template key per order (client uses for quick send)
  const withKeys = queue.map((o) => ({
    ...o,
    suggestedTemplateKey: pickTemplateKey({ status: o.status, attempts: o.attempts, shipDate: o.shipDate }),
  }));

  return NextResponse.json({
    queue: withKeys,
    doubleConfirm,
    counts: { queue: queue.length, doubleConfirm: doubleConfirm.length },
  });
}
