"use server";

import { createClient } from "@/utils/supabase/server";
import type { KpisResponse, OrderDTO } from "@/lib/types";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export async function getKpisServer(): Promise<KpisResponse> {
  const supabase = await verifyAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const d30 = new Date();
  d30.setDate(d30.getDate() - 30);
  d30.setHours(0, 0, 0, 0);

  // 1. Orders Today
  const { count: ordersTodayCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", today.toISOString());

  // 2. Orders Last 30 Days (for confirmation rate)
  const { data: orders30d } = await supabase
    .from("orders")
    .select("id, status, unit_price_mad, quantity, discount_mad, product:product_id(cost_mad), courier:courier_id(fee_per_delivery_mad, fee_per_return_mad)")
    .gte("created_at", d30.toISOString());

  // 3. Ad Spend Last 30 Days
  const { data: adSpendData } = await supabase
    .from("daily_ad_spend")
    .select("amount_mad")
    .gte("date", d30.toISOString().slice(0, 10));

  const totalAdSpend30d = (adSpendData || []).reduce((sum, row) => sum + row.amount_mad, 0);

  // 4. Followup Count (no_answer or retry)
  const { count: followupCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["no_answer", "retry"]);

  // 5. Latest Orders (last 10)
  const { data: latestOrdersData } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, city, total_mad, status")
    .order("created_at", { ascending: false })
    .limit(10);

  // Calculate KPIs
  let confirmedCount = 0;
  let totalForConfirmation = 0; // Exclude 'new'
  
  let deliveredCount = 0;
  let returnedCount = 0;
  
  let revenue30d = 0;
  let productCost30d = 0;
  let courierFees30d = 0;

  for (const o of (orders30d || [])) {
    if (o.status !== "new") {
      totalForConfirmation++;
      if (o.status === "confirmed" || o.status === "shipped" || o.status === "delivered") {
        confirmedCount++;
      }
    }

    if (o.status === "delivered") {
      deliveredCount++;
      revenue30d += (o.unit_price_mad * o.quantity) - (o.discount_mad || 0);
      productCost30d += (o.product?.cost_mad || 0) * o.quantity;
      courierFees30d += o.courier?.fee_per_delivery_mad || 0;
    } else if (o.status === "returned") {
      returnedCount++;
      courierFees30d += o.courier?.fee_per_return_mad || 0;
    }
  }

  const confirmationRate30d = totalForConfirmation > 0 ? confirmedCount / totalForConfirmation : 0;
  const deliveredRate30d = (deliveredCount + returnedCount) > 0 ? deliveredCount / (deliveredCount + returnedCount) : 0;
  const costPerDelivered30d = deliveredCount > 0 ? totalAdSpend30d / deliveredCount : 0;
  const netProfit30d = revenue30d - productCost30d - courierFees30d - totalAdSpend30d;

  return {
    ordersToday: ordersTodayCount || 0,
    confirmationRate30d,
    deliveredRate30d,
    costPerDelivered30d,
    revenue30d,
    netProfit30d,
    followupCount: followupCount || 0,
    latestOrders: (latestOrdersData || []).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      city: o.city,
      totalMad: o.total_mad,
      status: o.status,
    })) as OrderDTO[],
  };
}
