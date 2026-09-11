"use server";

import { createClient } from "@/utils/supabase/server";
import { pickTemplateKey } from "@/lib/whatsapp";
import type { OrderDTO } from "@/lib/types";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export interface FollowupResponse {
  queue: (OrderDTO & { suggestedTemplateKey?: string })[];
  doubleConfirm: OrderDTO[];
  counts: { queue: number; doubleConfirm: number };
}

export async function getFollowupServer(): Promise<FollowupResponse> {
  const supabase = await verifyAdmin();

  // Next.js runs this on the server
  const startOfTomorrow = new Date();
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  startOfTomorrow.setHours(0, 0, 0, 0);
  const endOfTomorrow = new Date(startOfTomorrow);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

  // Queue orders (no_answer or retry)
  const { data: queueData, error: queueError } = await supabase
    .from("orders")
    .select("*, product:product_id(id, name, cost_mad), courier:courier_id(id, name)")
    .in("status", ["no_answer", "retry"])
    .order("last_attempt_at", { ascending: true, nullsFirst: true });

  if (queueError) throw new Error(queueError.message);

  // Double confirm orders (confirmed, shipDate tomorrow)
  const { data: doubleData, error: doubleError } = await supabase
    .from("orders")
    .select("*, product:product_id(id, name, cost_mad), courier:courier_id(id, name)")
    .eq("status", "confirmed")
    .gte("ship_date", startOfTomorrow.toISOString())
    .lt("ship_date", endOfTomorrow.toISOString())
    .order("ship_date", { ascending: true });

  if (doubleError) throw new Error(doubleError.message);

  const mapToDTO = (row: any): OrderDTO => ({
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    phone: row.phone,
    city: row.city,
    district: row.district,
    landmark: row.landmark,
    productId: row.product_id,
    product: {
      id: row.product?.id || row.product_id,
      name: row.product?.name || 'منتج محذوف',
      costMad: row.product?.cost_mad || 0,
    },
    size: row.size,
    color: row.color,
    quantity: row.quantity,
    unitPriceMad: row.unit_price_mad,
    discountMad: 0,
    totalMad: (row.unit_price_mad * row.quantity),
    status: row.status,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at,
    shipDate: row.ship_date,
    courierId: row.courier_id,
    courier: row.courier ? { id: row.courier.id, name: row.courier.name } : null,
    tracking: row.tracking,
    notes: row.notes,
    returnReason: row.return_reason,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
  });

  const queue = (queueData || []).map(mapToDTO);
  const doubleConfirm = (doubleData || []).map(mapToDTO);

  const withKeys = queue.map((o) => ({
    ...o,
    suggestedTemplateKey: pickTemplateKey({ status: o.status, attempts: o.attempts, shipDate: o.shipDate }),
  }));

  return {
    queue: withKeys,
    doubleConfirm,
    counts: { queue: queue.length, doubleConfirm: doubleConfirm.length },
  };
}

export async function logConfirmedTodayServer(orderId: string) {
  const supabase = await verifyAdmin();
  
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    type: "status_change",
    detail: { from: "confirmed", to: "confirmed", note: "تأكد اليوم (تأكيد مزدوج)" }
  });

  if (error) throw new Error(error.message);
  return { success: true };
}
