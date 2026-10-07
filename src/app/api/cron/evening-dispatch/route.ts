import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDirectWhatsAppMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleEveningDispatch(req);
}

export async function POST(req: NextRequest) {
  return handleEveningDispatch(req);
}

async function handleEveningDispatch(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  );

  try {
    // 1. Fetch confirmed orders
    const { data: confirmedOrders, error: fetchErr } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, phone, status")
      .eq("status", "confirmed");

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!confirmedOrders || confirmedOrders.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "لا توجد أي طلبيات مؤكدة حالياً لإرسال الإشعار.",
      });
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
      return NextResponse.json({
        success: true,
        count: 0,
        message: "جميع الطلبيات المؤكدة تم إرسال إشعار الشحن لها مسبقاً.",
      });
    }

    const dispatchText = "سلام خويا، راه حنا صيفطنا لك الكوموند ديالك إن شاء الله تعالى، راها غادا تكون عندك فالقريب العاجل.";

    let sentCount = 0;
    const errors: string[] = [];

    for (const order of ordersToSend) {
      try {
        const res = await sendDirectWhatsAppMessage(order.phone, dispatchText);
        if (res.success || !res.error) {
          sentCount++;
          await supabase.from("order_events").insert({
            order_id: order.id,
            type: "evening_dispatch_sent",
            detail: {
              message: dispatchText,
              phone: order.phone,
              sent_at: new Date().toISOString(),
            },
          });

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

    return NextResponse.json({
      success: true,
      sentCount,
      totalEligible: ordersToSend.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `تم إرسال إشعار الشحن لـ ${sentCount} من أصل ${ordersToSend.length} طلبية مؤكدة بنجاح!`,
    });
  } catch (error: any) {
    console.error("Evening Dispatch Error:", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
