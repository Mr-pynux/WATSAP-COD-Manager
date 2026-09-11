"use server";

import { createClient } from "@/utils/supabase/server";
import type { CourierStatsDTO } from "@/lib/types";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export async function getCouriersDetailedServer(): Promise<{ couriers: CourierStatsDTO[] }> {
  const supabase = await verifyAdmin();
  const { data: couriersData, error: couriersError } = await supabase.from("couriers").select("*").order("name");
  if (couriersError) throw new Error(couriersError.message);

  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select("courier_id, status")
    .not("courier_id", "is", null)
    .in("status", ["delivered", "returned"]);

  if (ordersError) throw new Error(ordersError.message);

  const statsMap: Record<string, { delivered: number; returned: number }> = {};
  for (const c of couriersData || []) {
    statsMap[c.id] = { delivered: 0, returned: 0 };
  }

  for (const o of ordersData || []) {
    if (statsMap[o.courier_id]) {
      if (o.status === "delivered") statsMap[o.courier_id].delivered++;
      if (o.status === "returned") statsMap[o.courier_id].returned++;
    }
  }

  const couriers = (couriersData || []).map(row => {
    const s = statsMap[row.id];
    const d = s.delivered;
    const r = s.returned;
    const total = d + r;
    const returnRate = total > 0 ? r / total : 0;
    const totalFees = (d * row.fee_per_delivery_mad) + (r * row.fee_per_return_mad);
    
    return {
      id: row.id,
      name: row.name,
      contact: row.contact,
      feePerDeliveryMad: row.fee_per_delivery_mad,
      feePerReturnMad: row.fee_per_return_mad,
      deliveredCount: d,
      returnedCount: r,
      returnRate,
      totalFeesMad: totalFees,
    };
  }) as CourierStatsDTO[];

  return { couriers };
}

export async function addCourierServer(data: { name: string; contact?: string | null; feePerDeliveryMad: number; feePerReturnMad: number }) {
  const supabase = await verifyAdmin();
  const { error } = await supabase.from("couriers").insert({
    name: data.name,
    contact: data.contact,
    fee_per_delivery_mad: data.feePerDeliveryMad,
    fee_per_return_mad: data.feePerReturnMad,
  });

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateCourierServer(id: string, data: { feePerDeliveryMad: number; feePerReturnMad: number }) {
  const supabase = await verifyAdmin();
  const { error } = await supabase.from("couriers").update({
    fee_per_delivery_mad: data.feePerDeliveryMad,
    fee_per_return_mad: data.feePerReturnMad,
  }).eq("id", id);

  if (error) throw new Error(error.message);
  return { success: true };
}
