import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDirectWhatsAppMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Server-side Supabase client with Service Role Key
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  );
}

const ADMIN_PHONE = (process.env.ADMIN_WHATSAPP_PHONE || "212610026260").replace(/\D/g, "");

// STRICT THRESHOLD DATE: Only orders created on or after today (2026-10-09)
const START_DATE_FILTER = "2026-10-09T00:00:00.000Z";

export async function GET(req: NextRequest) {
  return handleReturnsRescue(req);
}

export async function POST(req: NextRequest) {
  return handleReturnsRescue(req);
}

async function handleReturnsRescue(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const now = Date.now();
    // 3 days in milliseconds: 3 * 24 * 60 * 60 * 1000 = 259,200,000 ms
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    // 1. Fetch orders in shipped or postponed status created FROM 2026-10-09 ONWARDS ONLY
    const { data: eligibleOrders, error: fetchErr } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, phone, city, status, size, color, created_at, shipped_at, last_attempt_at, unit_price_mad, quantity, product:product_id(name)")
      .gte("created_at", START_DATE_FILTER)
      .in("status", ["shipped", "postponed"])
      .order("created_at", { ascending: false });

    if (fetchErr) {
      console.error("[Returns Rescue] Fetch error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!eligibleOrders || eligibleOrders.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "لا توجد أي طلبيات معلقة (من تاريخ اليوم فما فوق) مؤهلة للإنقاذ حالياً.",
      });
    }

    // 2. Filter orders that have been waiting/shipped for 3+ days
    const orderIds = eligibleOrders.map((o) => o.id);
    const { data: sentEvents } = await supabase
      .from("order_events")
      .select("order_id, created_at")
      .eq("type", "returns_rescue_sent")
      .in("order_id", orderIds);

    const recentlySentMap = new Map<string, number>();
    for (const ev of sentEvents || []) {
      const evTime = new Date(ev.created_at).getTime();
      const existing = recentlySentMap.get(ev.order_id) || 0;
      if (evTime > existing) recentlySentMap.set(ev.order_id, evTime);
    }

    const ordersToRescue: typeof eligibleOrders = [];

    for (const order of eligibleOrders) {
      // Calculate how long it has been in shipping or postponed
      const refDateStr = order.shipped_at || order.last_attempt_at || order.created_at;
      const refTime = new Date(refDateStr).getTime();
      const ageMs = now - refTime;

      // Must be at least 3 days old
      if (ageMs < THREE_DAYS_MS) {
        continue;
      }

      // Must not have received a rescue notice within the last 48 hours
      const lastSentTime = recentlySentMap.get(order.id);
      if (lastSentTime && now - lastSentTime < 48 * 60 * 60 * 1000) {
        continue;
      }

      ordersToRescue.push(order);
    }

    if (ordersToRescue.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "جميع الطلبيات الحديثة إما تم إشعارها مسبقاً أو لم تكمل بعد 3 أيام من الشحن.",
      });
    }

    console.log(`[Returns Rescue] Found ${ordersToRescue.length} orders eligible for rescue.`);

    let sentCount = 0;
    const rescuedNumbers: number[] = [];

    for (const order of ordersToRescue) {
      const prodName = (order.product as any)?.name || "الحذاء";
      const customerName = order.customer_name?.trim() || "الزبون المحترم";
      const sizeStr = order.size ? ` (مقاس ${order.size})` : "";

      const rescueMessage =
        `سلام ${customerName} 👋\n\n` +
        `طلبك ديال ${prodName}${sizeStr} راه ما زال واصل لوكالة Express Coursier ومحجوز ليك ✅\n\n` +
        `الموزع حاول يتواصل معاك فـ هاد الأيام وما تيسراتش، واش متوفر غدا باش يدوز عندك يسلمو ليك؟ 🚚\n\n` +
        `جاوبنا بـ *1* لتأكيد الاستلام غدا 🙏 ولا بـ *2* للإلغاء`;

      try {
        const res = await sendDirectWhatsAppMessage(order.phone, rescueMessage);
        if (res.success || !res.error) {
          sentCount++;
          rescuedNumbers.push(order.order_number);

          await supabase.from("order_events").insert({
            order_id: order.id,
            type: "returns_rescue_sent",
            detail: {
              phone: order.phone,
              message: rescueMessage,
              sent_at: new Date().toISOString(),
            },
          });
        }
      } catch (err: any) {
        console.error(`[Returns Rescue] Error sending to ${order.phone}:`, err);
      }
    }

    // Notify Si Ayoub if any rescue messages were dispatched
    if (sentCount > 0 && ADMIN_PHONE) {
      const adminReport =
        `🔔 *[تقرير إنقاذ الكوليات من الرجوع]* 📦\n\n` +
        `تم إرسال رسائل إنقاذ أوتوماتيكية لـ *${sentCount}* كولية معلقة منذ 3+ أيام:\n` +
        `الطلبيات: *${rescuedNumbers.map((n) => `#${n}`).join(", ")}*\n\n` +
        `مع يجاوب أي زبون بـ التأكيد (1)، غيوصلك إشعار فـ الحين لإعادة التوزيع (Remise en distribution) فـ Express Coursier! 🚀`;

      await sendDirectWhatsAppMessage(ADMIN_PHONE, adminReport).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      sentCount,
      rescuedOrderNumbers: rescuedNumbers,
      message: `تم إرسال رسائل الإنقاذ لـ ${sentCount} طلبية بنجاح!`,
    });
  } catch (err: any) {
    console.error("[Returns Rescue Exception]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
