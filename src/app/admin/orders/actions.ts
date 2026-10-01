"use server";

import { createClient } from "@/utils/supabase/server";
import type { OrderDTO, OrdersResponse, CourierStatsDTO, BlacklistEntryDTO } from "@/lib/types";

// Helper to check admin access (already done in middleware, but good practice)
async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export async function getOrdersServer(
  filters: {
    status: string;
    city: string;
    courierId: string;
    phone: string;
    from: string;
    to: string;
  },
  page: number = 1
): Promise<OrdersResponse> {
  const supabase = await verifyAdmin();
  const PAGE_SIZE = 50;
  
  let query = supabase
    .from("orders")
    .select("*, product:product_id(id, name, cost_mad), courier:courier_id(id, name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.city && filters.city !== "all") {
    query = query.eq("city", filters.city);
  }
  if (filters.courierId && filters.courierId !== "all") {
    query = query.eq("courier_id", filters.courierId);
  }
  if (filters.phone && filters.phone.trim() !== "") {
    query = query.ilike("phone", `%${filters.phone.trim()}%`);
  }
  if (filters.from) {
    query = query.gte("created_at", `${filters.from}T00:00:00Z`);
  }
  if (filters.to) {
    query = query.lte("created_at", `${filters.to}T23:59:59Z`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const orders = (data || []).map(row => ({
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
    discountMad: 0, // not in DB schema currently
    totalMad: (row.unit_price_mad * row.quantity), // simplified
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
  })) as OrderDTO[];

  return {
    orders,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    blacklistPhones: [] // To be updated by UI if needed
  };
}

export async function getCouriersServer(): Promise<{ couriers: CourierStatsDTO[] }> {
  const supabase = await verifyAdmin();
  const { data, error } = await supabase.from("couriers").select("*").order("name");
  if (error) throw new Error(error.message);
  
  const couriers = (data || []).map(row => ({
    id: row.id,
    name: row.name,
    contact: row.contact,
    feePerDeliveryMad: row.fee_per_delivery_mad,
    feePerReturnMad: row.fee_per_return_mad,
    // default stats, proper calculation in Phase B5
    deliveredCount: 0,
    returnedCount: 0,
    returnRate: 0,
    totalFeesMad: 0
  })) as CourierStatsDTO[];

  return { couriers };
}

export async function getBlacklistServer(): Promise<{ entries: BlacklistEntryDTO[] }> {
  const supabase = await verifyAdmin();
  const { data, error } = await supabase.from("blacklist").select("*");
  if (error) throw new Error(error.message);

  const entries = (data || []).map(row => ({
    id: row.id,
    phone: row.phone,
    strikes: row.strikes,
    reasons: row.reasons || [],
    createdAt: row.created_at,
  })) as BlacklistEntryDTO[];

  return { entries };
}

export async function updateOrderStatusServer(id: string, status: string) {
  const supabase = await verifyAdmin();
  
  let updates: any = { status };
  
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString();
  if (status === 'shipped') updates.shipped_at = new Date().toISOString();
  if (status === 'delivered') updates.delivered_at = new Date().toISOString();
  
  const { error } = await supabase.from("orders").update(updates).eq("id", id);
  if (error) throw new Error(error.message);

  await supabase.from("order_events").insert({
    order_id: id,
    type: "status_change",
    detail: { new_status: status }
  });

  return { success: true };
}

export async function updateOrderDetailsServer(id: string, body: Record<string, any>) {
  const supabase = await verifyAdmin();
  
  const { error } = await supabase.from("orders").update({
    courier_id: body.courierId,
    tracking: body.tracking,
    ship_date: body.shipDate,
    notes: body.notes,
    status: body.status,
    return_reason: body.returnReason,
  }).eq("id", id);
  
  if (error) throw new Error(error.message);
  
  // if status was changed
  if (body.status) {
    await supabase.from("order_events").insert({
      order_id: id,
      type: "status_change",
      detail: { new_status: body.status }
    });
  }

  return { success: true };
}

export async function exportOrdersCSVServer(ids?: string[], filters?: any) {
  const supabase = await verifyAdmin();

  let query = supabase
    .from("orders")
    .select("id, order_number, customer_name, phone, city, district, landmark, product:product_id(name), size, color, quantity, total_mad, notes, status, created_at")
    .order("created_at", { ascending: false });

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  } else if (filters) {
    if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.city && filters.city !== "all") query = query.eq("city", filters.city);
    if (filters.courierId && filters.courierId !== "all") query = query.eq("courier_id", filters.courierId);
    if (filters.phone) query = query.like("phone", `%${filters.phone}%`);
    if (filters.from) query = query.gte("created_at", new Date(filters.from).toISOString());
    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt("created_at", toDate.toISOString());
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const headers = [
    "الرقم",
    "الزبون",
    "الهاتف",
    "المدينة",
    "العنوان (الحي / العلامة)",
    "المنتج",
    "المقاس/اللون",
    "الكمية",
    "المبلغ (COD)",
    "الملاحظات",
    "الحالة",
    "التاريخ",
  ];

  const rows = (data || []).map((o) => {
    const address = [o.district, o.landmark].filter(Boolean).join(" - ");
    const productDetail = [o.size, o.color].filter(Boolean).join(" / ");
    return [
      o.order_number,
      o.customer_name,
      o.phone,
      o.city,
      address,
      o.product?.name || "-",
      productDetail,
      o.quantity,
      o.total_mad,
      (o.notes || "").replace(/\n/g, " "), // remove newlines for CSV
      o.status,
      new Date(o.created_at).toLocaleString("en-GB")
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\r\n");
  
  // Return the CSV as a string. We also prepend the UTF-8 BOM so Excel opens Arabic correctly.
  return { csv: "\uFEFF" + csv };
}

export async function bulkUpdateStatusServer(ids: string[], status: string) {
  const supabase = await verifyAdmin();
  
  const { error } = await supabase.from("orders").update({ status }).in("id", ids);
  if (error) throw new Error(error.message);

  const events = ids.map(id => ({
    order_id: id,
    type: "status_change",
    detail: { new_status: status, is_bulk: true }
  }));
  
  await supabase.from("order_events").insert(events);

  return { success: true, changed: ids.length };
}

export async function bulkDeleteOrdersServer(ids: string[]) {
  const supabase = await verifyAdmin();
  
  // order_events might have a foreign key constraint referencing orders
  await supabase.from("order_events").delete().in("order_id", ids);
  
  const { error } = await supabase.from("orders").delete().in("id", ids);
  if (error) throw new Error(error.message);

  return { success: true, deleted: ids.length };
}

export async function logWhatsAppAttemptServer(orderId: string, templateKey?: string) {
  const supabase = await verifyAdmin();
  
  // 1. Get the order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
    
  if (orderError || !order) throw new Error("Order not found");

  // 2. Increment attempts & change status if no_answer
  let newStatus = order.status;
  if (order.status === "no_answer") {
    newStatus = "retry";
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      attempts: order.attempts + 1,
      last_attempt_at: new Date().toISOString(),
      status: newStatus
    })
    .eq("id", orderId);
    
  if (updateError) throw new Error(updateError.message);

  // 3. Log event
  await supabase.from("order_events").insert({
    order_id: orderId,
    type: "whatsapp_click",
    detail: { template_key: templateKey || 'default' }
  });

  // 4. Generate text for WA link
  let text = `سلام ${order.customer_name}،
نتمنى تكون بخير. بخصوص طلبك الأخير...`; // Basic text if no template, Phase B6 adds real templates

  if (templateKey) {
     const { data: tmpl } = await supabase.from("message_templates").select("body_ar").eq("key", templateKey).single();
     if (tmpl) text = tmpl.body_ar;
  }

  // Generate URL
  let phone = order.phone.replace(/[^0-9]/g, "");
  if (phone.startsWith("0")) phone = "212" + phone.substring(1);
  
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  
  return { url, success: true };
}
