"use server";

import { createClient } from "@/utils/supabase/server";
import { orderTotal } from "@/lib/pricing";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export interface ProductPnlDTO {
  productId: string;
  productName: string;
  deliveredCount: number;
  returnedCount: number;
  revenueMad: number;
  productCostMad: number;
  courierFeesMad: number;
  adSpendMad: number;
  ordersShare: number; // 0..1
  netMad: number;
}

export interface PnlResponse {
  products: ProductPnlDTO[];
  adSpend30d: number;
  totalOrders30d: number;
  summary: {
    revenueMad: number;
    totalCostsMad: number;
    netMad: number;
    productCostMad: number;
    courierFeesMad: number;
  };
}

export async function getFinancePnlServer(): Promise<PnlResponse> {
  const supabase = await verifyAdmin();

  const d30 = new Date();
  d30.setDate(d30.getDate() - 30);
  d30.setHours(0, 0, 0, 0);

  // Fetch all active products
  const { data: products } = await supabase.from("products").select("*");

  // Fetch all orders created in the last 30 days for orderShare calculation
  const { data: orders30Data } = await supabase
    .from("orders")
    .select("id, product_id")
    .gte("created_at", d30.toISOString());

  // Fetch all delivered orders in last 30 days
  const { data: deliveredData } = await supabase
    .from("orders")
    .select("*, product:product_id(cost_mad), courier:courier_id(fee_per_delivery_mad, fee_per_return_mad)")
    .eq("status", "delivered")
    .gte("delivered_at", d30.toISOString());

  // Fetch all returned orders in last 30 days
  const { data: returnedData } = await supabase
    .from("orders")
    .select("*, product:product_id(cost_mad), courier:courier_id(fee_per_delivery_mad, fee_per_return_mad)")
    .eq("status", "returned")
    .gte("delivered_at", d30.toISOString());

  // Fetch ad spend
  const { data: adSpendData } = await supabase
    .from("daily_ad_spend")
    .select("amount_mad")
    .gte("date", d30.toISOString().slice(0, 10));

  const adSpend30d = (adSpendData || []).reduce((acc, curr) => acc + curr.amount_mad, 0);
  const totalOrders30d = (orders30Data || []).length;

  const rows: ProductPnlDTO[] = (products || []).map((p) => {
    const del = (deliveredData || []).filter((o) => o.product_id === p.id);
    const ret = (returnedData || []).filter((o) => o.product_id === p.id);
    const productOrders = (orders30Data || []).filter((o) => o.product_id === p.id).length;

    const revenueMad = del.reduce(
      (s, o) => s + orderTotal(o.quantity, o.unit_price_mad, 0),
      0
    );
    const productCostMad = del.reduce((s, o) => s + (o.product?.cost_mad || 0) * o.quantity, 0);
    const courierFeesMad =
      del.reduce((s, o) => s + (o.courier?.fee_per_delivery_mad ?? 0), 0) +
      ret.reduce((s, o) => s + (o.courier?.fee_per_return_mad ?? 0), 0);

    const ordersShare = totalOrders30d > 0 ? productOrders / totalOrders30d : 0;
    const adSpendMad = adSpend30d * ordersShare;

    return {
      productId: p.id,
      productName: p.name,
      deliveredCount: del.length,
      returnedCount: ret.length,
      revenueMad,
      productCostMad,
      courierFeesMad,
      adSpendMad,
      ordersShare,
      netMad: revenueMad - productCostMad - courierFeesMad - adSpendMad,
    };
  });

  const summaryRevenue = rows.reduce((s, r) => s + r.revenueMad, 0);
  const summaryProductCost = rows.reduce((s, r) => s + r.productCostMad, 0);
  const summaryCourierFees = rows.reduce((s, r) => s + r.courierFeesMad, 0);
  const summaryTotalCosts = summaryProductCost + summaryCourierFees + adSpend30d;

  return {
    products: rows,
    adSpend30d,
    totalOrders30d,
    summary: {
      revenueMad: summaryRevenue,
      totalCostsMad: summaryTotalCosts,
      netMad: summaryRevenue - summaryTotalCosts,
      productCostMad: summaryProductCost,
      courierFeesMad: summaryCourierFees,
    },
  };
}

export async function getAdSpendServer(): Promise<{ entries: { date: string; amountMad: number }[] }> {
  const supabase = await verifyAdmin();
  const { data, error } = await supabase
    .from("daily_ad_spend")
    .select("*")
    .order("date", { ascending: false })
    .limit(14);

  if (error) throw new Error(error.message);

  return {
    entries: (data || []).map((e) => ({
      date: e.date, // already yyyy-MM-dd since it's a date field
      amountMad: e.amount_mad,
    })),
  };
}

export async function saveAdSpendServer(date: string, amountMad: number) {
  const supabase = await verifyAdmin();
  const { error } = await supabase
    .from("daily_ad_spend")
    .upsert({ date, amount_mad: amountMad }, { onConflict: "date" });

  if (error) throw new Error(error.message);
  return { success: true };
}
