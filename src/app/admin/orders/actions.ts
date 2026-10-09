"use server";

import { createClient } from "@/utils/supabase/server";
import { sendDirectWhatsAppMessage } from "@/lib/whatsapp";
import type { OrderDTO, OrdersResponse, CourierStatsDTO, BlacklistEntryDTO } from "@/lib/types";
import { createExpressCoursierParcel } from "@/lib/express-coursier";

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
    if (filters.status === "scammer") {
      query = query.or("status.eq.scammer,return_reason.eq.scammer,notes.ilike.%[SCAMMER]%");
    } else {
      query = query.eq("status", filters.status);
    }
  }
  if (filters.city && filters.city !== "all") {
    query = query.eq("city", filters.city);
  }
  if (filters.courierId && filters.courierId !== "all") {
    query = query.eq("courier_id", filters.courierId);
  }
  if (filters.phone && filters.phone.trim() !== "") {
    const term = filters.phone.trim();
    const cleanNum = parseInt(term.replace(/\D/g, ""), 10);
    if (!isNaN(cleanNum) && term.length <= 6 && !term.startsWith("0")) {
      query = query.or(`order_number.eq.${cleanNum},phone.ilike.%${term}%,tracking.ilike.%${term}%,customer_name.ilike.%${term}%`);
    } else {
      query = query.or(`phone.ilike.%${term}%,tracking.ilike.%${term}%,customer_name.ilike.%${term}%`);
    }
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

  const orderIds = (data || []).map((r: any) => r.id);
  const itemsByOrderId: Record<string, any[]> = {};

  if (orderIds.length > 0) {
    const { data: events } = await supabase
      .from("order_events")
      .select("order_id, detail")
      .in("order_id", orderIds)
      .eq("type", "created");

    for (const ev of events || []) {
      if (ev.detail && Array.isArray((ev.detail as any).items) && (ev.detail as any).items.length > 0) {
        itemsByOrderId[ev.order_id] = (ev.detail as any).items;
      }
    }
  }

  // Fetch all active/available products for image resolution fallback
  const { data: allProductsList } = await supabase
    .from("products")
    .select("id, name, image_urls");

  const orders = (data || []).map((row: any) => {
    const primaryItem = {
      productId: row.product?.id || row.product_id,
      name: row.product?.name || 'منتج محذوف',
      size: row.size,
      color: row.color,
      quantity: row.quantity,
      priceMad: row.unit_price_mad,
      imageUrl: row.product?.image_urls?.[0] || null,
    };
    const eventItems = itemsByOrderId[row.id];
    const rawItems = Array.isArray(row.items) && row.items.length > 0 
      ? row.items 
      : (eventItems && eventItems.length > 0 ? eventItems : [primaryItem]);

    const items = rawItems.map((it: any) => {
      let img = it.imageUrl;
      let pid = it.productId;
      if (!img || !pid) {
        const itNameLower = (it.name || "").toLowerCase();
        const matched = (allProductsList || []).find((p: any) =>
          (pid && p.id === pid) ||
          (itNameLower && (p.name.toLowerCase().includes(itNameLower) || itNameLower.includes(p.name.toLowerCase()))) ||
          (itNameLower.includes("cobra") && p.name.toLowerCase().includes("cobra")) ||
          (itNameLower.includes("balance") && p.name.toLowerCase().includes("balance"))
        );
        if (matched) {
          if (!img && matched.image_urls?.[0]) img = matched.image_urls[0];
          if (!pid) pid = matched.id;
        }
      }
      return {
        ...it,
        productId: pid || row.product_id,
        imageUrl: img || row.product?.image_urls?.[0] || null,
      };
    });

    return {
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
        imageUrls: row.product?.image_urls || [],
      },
      items,
      size: row.size,
      color: row.color,
      quantity: row.quantity,
      unitPriceMad: row.unit_price_mad,
      discountMad: 0,
      totalMad: (row.unit_price_mad * row.quantity),
      status: (row.status === 'scammer' || row.return_reason === 'scammer' || (typeof row.notes === 'string' && row.notes.includes('[SCAMMER]'))) ? 'scammer' : row.status,
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
    };
  }) as OrderDTO[];

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

async function addOrderPhoneToBlacklist(supabase: any, orderId: string, reason = "نصاب - ما خداش الكوموند كيتفلى") {
  try {
    const { data: ord } = await supabase.from("orders").select("phone, customer_name, order_number").eq("id", orderId).maybeSingle();
    if (ord?.phone) {
      const clean = ord.phone.replace(/\D/g, "");
      const phone06 = clean.startsWith("212") ? "0" + clean.slice(3) : clean;
      const fullReason = `${reason} (طلب #${ord.order_number})`;
      
      const { data: existing } = await supabase.from("blacklist").select("id, strikes, reasons").eq("phone", phone06).maybeSingle();
      if (existing) {
        const reasons = [...(existing.reasons || []), fullReason];
        await supabase.from("blacklist").update({
          strikes: (existing.strikes || 1) + 2,
          reasons,
        }).eq("id", existing.id);
      } else {
        await supabase.from("blacklist").insert({
          phone: phone06,
          strikes: 2,
          reasons: [fullReason],
        });
      }
      console.log(`[Blacklist Auto] Added scammer phone ${phone06} for order #${ord.order_number}`);
    }
  } catch (err) {
    console.error("Error auto-adding to blacklist:", err);
  }
}

export async function updateOrderStatusServer(id: string, status: string) {
  const supabase = await verifyAdmin();
  
  if (status === 'scammer') {
    await addOrderPhoneToBlacklist(supabase, id, "نصاب - ما خداش الكوموند كيتفلى");
  }

  let updates: any = { status };
  
  if (status === 'confirmed' || status === 'confirmed_continuous') updates.confirmed_at = new Date().toISOString();
  if (status === 'shipped') updates.shipped_at = new Date().toISOString();
  if (status === 'delivered') updates.delivered_at = new Date().toISOString();
  
  const { error } = await supabase.from("orders").update(updates).eq("id", id);
  if (error) {
    if (status === 'scammer') {
      // Graceful fallback if orders_status_check DDL constraint is not yet updated
      const { error: fallbackErr } = await supabase.from("orders").update({
        status: 'canceled',
        return_reason: 'scammer',
        notes: `[SCAMMER: نصاب]`.trim(),
      }).eq("id", id);
      if (fallbackErr) throw new Error(fallbackErr.message);
    } else {
      throw new Error(error.message);
    }
  }

  await supabase.from("order_events").insert({
    order_id: id,
    type: "status_change",
    detail: { new_status: status }
  });

  return { success: true };
}

export async function updateOrderDetailsServer(id: string, body: Record<string, any>) {
  const supabase = await verifyAdmin();
  
  if (body.status === 'scammer') {
    await addOrderPhoneToBlacklist(supabase, id, "نصاب - ما خداش الكوموند كيتفلى");
  }

  const updateData: Record<string, any> = {
    courier_id: body.courierId,
    tracking: body.tracking,
    ship_date: body.shipDate,
    notes: body.notes,
    status: body.status,
    return_reason: body.returnReason,
  };

  if (body.status === 'confirmed' || body.status === 'confirmed_continuous') {
    updateData.confirmed_at = new Date().toISOString();
  } else if (body.status === 'shipped') {
    updateData.shipped_at = new Date().toISOString();
  } else if (body.status === 'delivered') {
    updateData.delivered_at = new Date().toISOString();
  }

  const { error } = await supabase.from("orders").update(updateData).eq("id", id);
  if (error) {
    if (body.status === 'scammer') {
      updateData.status = 'canceled';
      updateData.return_reason = 'scammer';
      updateData.notes = `[SCAMMER: نصاب] ${body.notes || ''}`.trim();
      const { error: fallbackErr } = await supabase.from("orders").update(updateData).eq("id", id);
      if (fallbackErr) throw new Error(fallbackErr.message);
    } else {
      throw new Error(error.message);
    }
  }
  
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

export async function dispatchOrderToExpressCoursierServer(id: string) {
  try {
    const supabase = await verifyAdmin();

    // 1. Fetch order details with product
    const { data: order, error } = await supabase
      .from("orders")
      .select("*, product:product_id(name)")
      .eq("id", id)
      .single();

    if (error || !order) {
      return { success: false, error: error?.message || "الطلبية غير موجودة" };
    }

    // 2. Courier ID for Express Coursier
    const courierId = "87fbd228-a050-4183-9c60-3fc071698389";

    // Build product description
    let productText = "";
    if (Array.isArray(order.items) && order.items.length > 0) {
      productText = order.items
        .map((it: any) => `${it.name || "منتج"} (${it.size || ""}) x${it.quantity || 1}`)
        .join(" + ");
    } else {
      productText = `${order.product?.name || "منتج"} (${order.size || ""}) x${order.quantity || 1}`;
    }

    const address =
      [order.district, order.landmark].filter(Boolean).join(" - ") ||
      order.city ||
      "العنوان غير محدد";

    // 3. Call Express Coursier Live Platform API (expresscoursier.ma)
    const parcelRes = await createExpressCoursierParcel({
      receiver_name: order.customer_name || "زبون",
      address,
      city: order.city || "Casablanca",
      phone: order.phone,
      price: (order.unit_price_mad || 0) * (order.quantity || 1),
      product: productText,
      note: order.notes || "",
      internal_id: order.order_number ? `ORD-${order.order_number}` : `ORD-${order.id.slice(0, 8)}`,
    });

    if (!parcelRes.success || !parcelRes.package_id) {
      return {
        success: false,
        error: parcelRes.error || "فشل إرسال الكولية إلى منصة Express Coursier",
      };
    }

    // 4. Update order in Supabase with real Express Coursier package tracking code
    const { error: updateErr } = await supabase
      .from("orders")
      .update({
        status: "shipped",
        courier_id: courierId,
        tracking: parcelRes.package_id,
        shipped_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // 5. Log order event
    await supabase.from("order_events").insert({
      order_id: id,
      type: "express_coursier_dispatched",
      detail: {
        package_id: parcelRes.package_id,
        tracking: parcelRes.package_id,
        store_id: 12515,
        dispatched_at: new Date().toISOString(),
        created_on_express_site: true,
      },
    });

    return {
      success: true,
      package_id: parcelRes.package_id,
      tracking: parcelRes.package_id,
    };
  } catch (err: any) {
    console.error("[dispatchOrderToExpressCoursierServer Error]:", err);
    return {
      success: false,
      error: err.message || "حدث خطأ غير متوقع أثناء الاتصال بشركة التوصيل",
    };
  }
}

export async function bulkDispatchOrdersToExpressCoursierServer(ids: string[]) {
  const results: any[] = [];
  const errors: any[] = [];

  for (const id of ids) {
    try {
      const res = await dispatchOrderToExpressCoursierServer(id);
      results.push({ id, tracking: res.tracking });
    } catch (err: any) {
      errors.push({ id, error: err.message });
    }
  }

  return {
    success: results.length > 0,
    count: results.length,
    failedCount: errors.length,
    results,
    errors,
  };
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
  
  if (status === 'scammer') {
    for (const id of ids) {
      await addOrderPhoneToBlacklist(supabase, id, "نصاب - ما خداش الكوموند كيتفلى");
    }
  }

  const { error } = await supabase.from("orders").update({ status }).in("id", ids);
  if (error) {
    if (status === 'scammer') {
      const { error: fallbackErr } = await supabase.from("orders").update({
        status: 'canceled',
        return_reason: 'scammer',
        notes: `[SCAMMER: نصاب]`.trim(),
      }).in("id", ids);
      if (fallbackErr) throw new Error(fallbackErr.message);
    } else {
      throw new Error(error.message);
    }
  }

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

/**
 * Count how many confirmed orders are pending the evening dispatch notice
 */
export async function getPendingEveningDispatchCountServer() {
  const supabase = await verifyAdmin();

  // Find all confirmed and confirmed_continuous orders
  const { data: confirmedOrders, error } = await supabase
    .from("orders")
    .select("id")
    .in("status", ["confirmed_continuous", "confirmed"]);

  if (error || !confirmedOrders) return { count: 0 };

  const ids = confirmedOrders.map((o) => o.id);
  if (ids.length === 0) return { count: 0 };

  // Check which ones already had evening_dispatch_sent
  const { data: sentEvents } = await supabase
    .from("order_events")
    .select("order_id")
    .eq("type", "evening_dispatch_sent")
    .in("order_id", ids);

  const sentOrderIds = new Set((sentEvents || []).map((e) => e.order_id));
  const pendingCount = ids.filter((id) => !sentOrderIds.has(id)).length;

  return { count: pendingCount };
}

/**
 * Send evening dispatch WhatsApp notification (8:00 PM - 10:00 PM) to all confirmed orders
 * Message: "سلام خويا، راه حنا صيفطنا لك الكوموند ديالك إن شاء الله تعالى، راها غادا تكون عندك فالقريب العاجل."
 */
export async function sendEveningDispatchServer() {
  const supabase = await verifyAdmin();

  // 1. Fetch confirmed and confirmed_continuous orders
  const { data: confirmedOrders, error: fetchErr } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, phone, status")
    .in("status", ["confirmed_continuous", "confirmed"]);

  if (fetchErr) throw new Error(fetchErr.message);
  if (!confirmedOrders || confirmedOrders.length === 0) {
    return { success: true, count: 0, message: "لا توجد أي طلبيات مؤكدة حالياً لإرسال الإشعار." };
  }

  // 2. Filter out orders that already received the evening dispatch notice
  const ids = confirmedOrders.map((o) => o.id);
  const { data: sentEvents } = await supabase
    .from("order_events")
    .select("order_id")
    .eq("type", "evening_dispatch_sent")
    .in("order_id", ids);

  const sentOrderIds = new Set((sentEvents || []).map((e) => e.order_id));
  const ordersToSend = confirmedOrders.filter((o) => !sentOrderIds.has(o.id));

  if (ordersToSend.length === 0) {
    return { success: true, count: 0, message: "جميع الطلبيات المؤكدة تم إرسال إشعار الشحن لها مسبقاً." };
  }

  const dispatchText = "سلام خويا، راه حنا صيفطنا لك الكوموند ديالك إن شاء الله تعالى، راه غادي يتواصل معاك الليفرور فـ أقرب وقت باش يجيبها ليك.";

  let sentCount = 0;
  const errors: string[] = [];

  for (const order of ordersToSend) {
    try {
      const res = await sendDirectWhatsAppMessage(order.phone, dispatchText);
      if (res.success || !res.error) {
        sentCount++;
        // Log event
        await supabase.from("order_events").insert({
          order_id: order.id,
          type: "evening_dispatch_sent",
          detail: {
            message: dispatchText,
            phone: order.phone,
            sent_at: new Date().toISOString(),
          },
        });

        // Update shipped_at timestamp and status to shipped
        await supabase
          .from("orders")
          .update({
            status: "shipped",
            shipped_at: new Date().toISOString(),
          })
          .eq("id", order.id);
      } else {
        errors.push(`فشل الإرسال لـ ${order.phone}: ${JSON.stringify(res.error)}`);
      }
    } catch (err: any) {
      errors.push(`خطأ لـ ${order.phone}: ${err.message}`);
    }
  }

  return {
    success: true,
    count: sentCount,
    totalEligible: ordersToSend.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `تم إرسال إشعار الشحن لـ ${sentCount} من أصل ${ordersToSend.length} طلبية مؤكدة بنجاح!`,
  };
}

export async function getOrderByIdServer(id: string): Promise<OrderDTO | null> {
  const supabase = await verifyAdmin();
  const { data: row, error } = await supabase
    .from("orders")
    .select("*, product:product_id(id, name, cost_mad, image_urls), courier:courier_id(id, name)")
    .eq("id", id)
    .single();

  if (error || !row) return null;

  // Fetch created event for items fallback
  const { data: events } = await supabase
    .from("order_events")
    .select("detail")
    .eq("order_id", id)
    .eq("type", "created")
    .limit(1);

  const eventItems = events?.[0]?.detail && Array.isArray((events[0].detail as any).items) 
    ? (events[0].detail as any).items 
    : undefined;

  const primaryItem = {
    productId: row.product?.id || row.product_id,
    name: row.product?.name || 'منتج',
    size: row.size,
    color: row.color,
    quantity: row.quantity,
    priceMad: row.unit_price_mad,
    imageUrl: row.product?.image_urls?.[0] || null,
  };

  const rawItems = Array.isArray(row.items) && row.items.length > 0
    ? row.items
    : (eventItems && eventItems.length > 0 ? eventItems : [primaryItem]);

  // Fetch all products to guarantee images and valid product IDs
  const { data: allProductsList } = await supabase
    .from("products")
    .select("id, name, image_urls");

  const items = rawItems.map((it: any) => {
    let img = it.imageUrl;
    let pid = it.productId;
    if (!img || !pid) {
      const itNameLower = (it.name || "").toLowerCase();
      const matched = (allProductsList || []).find((p: any) => 
        (pid && p.id === pid) ||
        (itNameLower && (p.name.toLowerCase().includes(itNameLower) || itNameLower.includes(p.name.toLowerCase()))) ||
        (itNameLower.includes("cobra") && p.name.toLowerCase().includes("cobra")) ||
        (itNameLower.includes("balance") && p.name.toLowerCase().includes("balance"))
      );
      if (matched) {
        if (!img && matched.image_urls?.[0]) img = matched.image_urls[0];
        if (!pid) pid = matched.id;
      }
    }
    return {
      ...it,
      productId: pid || row.product_id,
      imageUrl: img || row.product?.image_urls?.[0] || null,
    };
  });

  return {
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
      name: row.product?.name || 'منتج',
      costMad: row.product?.cost_mad || 0,
      imageUrls: row.product?.image_urls || [],
    },
    items,
    size: row.size,
    color: row.color,
    quantity: row.quantity,
    unitPriceMad: row.unit_price_mad,
    discountMad: 0,
    totalMad: (row.unit_price_mad * row.quantity),
    status: (row.status === 'scammer' || row.return_reason === 'scammer' || (typeof row.notes === 'string' && row.notes.includes('[SCAMMER]'))) ? 'scammer' : row.status,
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
  } as OrderDTO;
}

