import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDirectWhatsAppMessage } from "@/lib/whatsapp";

// Server-side Supabase client with Service Role Key
function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration in environment variables");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

const ADMIN_PHONE = (process.env.ADMIN_WHATSAPP_PHONE || "212610026260").replace(/\D/g, "");

// GET handler for Webhook health checks
export async function GET(req: NextRequest) {
  return NextResponse.json(
    {
      status: "EXPRESS_COURSIER_WEBHOOK_ACTIVE",
      store: "shoespot",
      store_id: process.env.EXPRESS_COURSIER_STORE_ID || "12515",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

// POST handler for receiving real-time courier updates
export async function POST(req: NextRequest) {
  try {
    let payload: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      const rawText = await req.text();
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = { raw: rawText };
      }
    }

    console.log("[Express Coursier Webhook Received]:", JSON.stringify(payload, null, 2));

    const supabase = getSupabaseServerClient();

    // Extract package data whether it is direct or nested in package / data
    const pkg = payload.package || payload.data || payload.colis || payload;

    const rawStatus = (
      pkg.status ||
      pkg.statut ||
      pkg.status_name ||
      pkg.etat ||
      payload.event ||
      payload.status ||
      ""
    ).toString().trim();

    const tracking = (
      pkg.tracking ||
      pkg.tracking_number ||
      pkg.code_suivi ||
      pkg.code_envoi ||
      pkg.code ||
      payload.tracking ||
      ""
    ).toString().trim();

    const internalId = (
      pkg.internal_id ||
      pkg.order_id ||
      pkg.order_number ||
      pkg.reference ||
      pkg.ref ||
      payload.internal_id ||
      ""
    ).toString().trim();

    const phone = (
      pkg.phone ||
      pkg.receiver_phone ||
      pkg.telephone ||
      payload.phone ||
      ""
    ).toString().trim();

    const note = (
      pkg.note ||
      pkg.motif ||
      pkg.commentaire ||
      pkg.comment ||
      payload.note ||
      ""
    ).toString().trim();

    // Check if this is a simulation / test webhook triggered by Express Coursier test button
    const isTestSimulation =
      payload.test === true ||
      payload.is_test === true ||
      rawStatus.toLowerCase().includes("test") ||
      note.toLowerCase().includes("test") ||
      (typeof pkg.product === "string" && pkg.product.toLowerCase().includes("test"));

    // Find the matching order in Shoespot database
    let matchedOrder: any = null;

    if (tracking) {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("tracking", tracking)
        .maybeSingle();
      if (data) matchedOrder = data;
    }

    if (!matchedOrder && internalId) {
      const num = parseInt(internalId.replace(/\D/g, ""), 10);
      if (!isNaN(num)) {
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq("order_number", num)
          .maybeSingle();
        if (data) matchedOrder = data;
      }
      if (!matchedOrder && internalId.length > 20) {
        // Maybe UUID
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq("id", internalId)
          .maybeSingle();
        if (data) matchedOrder = data;
      }
    }

    if (!matchedOrder && phone) {
      const clean = phone.replace(/\D/g, "");
      const p06 = clean.startsWith("212") ? "0" + clean.slice(3) : clean;
      const p212 = clean.startsWith("0") ? "212" + clean.slice(1) : clean;

      const { data } = await supabase
        .from("orders")
        .select("*")
        .or(`phone.eq.${p06},phone.eq.${p212}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) matchedOrder = data;
    }

    // Determine normalized Shoespot status
    const lowerStatus = rawStatus.toLowerCase();
    let newShoespotStatus: string | null = null;
    let statusLabelAr = rawStatus;

    if (lowerStatus.includes("livr") || lowerStatus.includes("delivered") || lowerStatus.includes("paye") || lowerStatus.includes("cloture")) {
      newShoespotStatus = "delivered";
      statusLabelAr = "تم التوصيل بنجاح ✅";
    } else if (
      lowerStatus.includes("cours") ||
      lowerStatus.includes("ramass") ||
      lowerStatus.includes("expedi") ||
      lowerStatus.includes("transit") ||
      lowerStatus.includes("centre")
    ) {
      newShoespotStatus = "shipped";
      statusLabelAr = "في طريق التوصيل 🚚";
    } else if (
      lowerStatus.includes("report") ||
      lowerStatus.includes("injoignable") ||
      lowerStatus.includes("pas de reponse") ||
      lowerStatus.includes("programme")
    ) {
      newShoespotStatus = "postponed";
      statusLabelAr = "تأجيل التوصيل ⏳";
    } else if (
      lowerStatus.includes("refus") ||
      lowerStatus.includes("retour") ||
      lowerStatus.includes("annul")
    ) {
      newShoespotStatus = "returned";
      statusLabelAr = "طلب راجع / ملغي ❌";
    }

    if (matchedOrder) {
      const updates: any = {};
      if (newShoespotStatus) updates.status = newShoespotStatus;
      if (newShoespotStatus === "delivered" && !matchedOrder.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }
      if (newShoespotStatus === "shipped" && !matchedOrder.shipped_at) {
        updates.shipped_at = new Date().toISOString();
      }
      if (tracking && !matchedOrder.tracking) {
        updates.tracking = tracking;
      }
      if (note) {
        updates.notes = matchedOrder.notes ? `${matchedOrder.notes} | [EC: ${note}]` : `[EC: ${note}]`;
      }
      if (newShoespotStatus === "returned") {
        updates.return_reason = note || rawStatus;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("orders").update(updates).eq("id", matchedOrder.id);
      }

      await supabase.from("order_events").insert({
        order_id: matchedOrder.id,
        type: "express_coursier_webhook",
        detail: {
          rawStatus,
          newShoespotStatus,
          tracking,
          note,
          payload,
        },
      });

      // Send WhatsApp notification to Admin (Si Ayoub)
      const totalMad = matchedOrder.unit_price_mad * matchedOrder.quantity;
      let waMessage = "";

      if (newShoespotStatus === "delivered") {
        waMessage = `🎉 *[Express Coursier: تم تسليم كولية بنجاح!]* ✅\n` +
          `📦 الطلبية: *#${matchedOrder.order_number}*\n` +
          `👤 الزبون: ${matchedOrder.customer_name}\n` +
          `📍 المدينة: ${matchedOrder.city}\n` +
          `💰 المبلغ المحصل: *${totalMad} درهم*\n` +
          `🔖 كود التتبع: ${tracking || matchedOrder.tracking || "—"}`;
      } else if (newShoespotStatus === "returned") {
        waMessage = `⚠️ *[Express Coursier: كولية راجعة / مرفوضة]* ❌\n` +
          `📦 الطلبية: *#${matchedOrder.order_number}*\n` +
          `👤 الزبون: ${matchedOrder.customer_name} (${matchedOrder.phone})\n` +
          `📍 المدينة: ${matchedOrder.city}\n` +
          `❗ السبب: ${note || rawStatus}`;
      } else {
        waMessage = `🚚 *[Express Coursier: تحديث حالة كولية]*\n` +
          `📦 الطلبية: *#${matchedOrder.order_number}* (${matchedOrder.customer_name})\n` +
          `📊 الحالة: *${statusLabelAr}* (${rawStatus})\n` +
          `🔖 التتبع: ${tracking || matchedOrder.tracking || "—"}`;
      }

      if (ADMIN_PHONE) {
        await sendDirectWhatsAppMessage(ADMIN_PHONE, waMessage);
      }

      console.log(`[Express Coursier Webhook] Order #${matchedOrder.order_number} updated to ${newShoespotStatus || rawStatus}`);
    } else {
      // Unmatched order (could be a test package from the simulation test button)
      console.log("[Express Coursier Webhook] No matching order found for payload:", payload);

      if (isTestSimulation || rawStatus.toLowerCase().includes("attente") || rawStatus.toLowerCase().includes("nouveau")) {
        // Send confirmation alert to Admin that Webhook is officially alive and receiving test events
        const testNotice = `📡 *[نجاح اختبار الربط مع Express Coursier!]* ✅\n\n` +
          `وصل إشعار التيست بنجاح من منصة Express Coursier إلى السيرفر! 🚀\n` +
          `• الحالة المستلمة: *${rawStatus || "Colis de test"}*\n` +
          `• كود التتبع: *${tracking || "TEST"}*\n\n` +
          `نظام الـ Webhook خدام دابا 100% وغادي يتابع أي كولية حقيقية تسلمات أو تبدلات حالتها أوتوماتيكياً! 👏`;

        if (ADMIN_PHONE) {
          await sendDirectWhatsAppMessage(ADMIN_PHONE, testNotice);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Webhook received and processed successfully",
        matched_order: matchedOrder ? matchedOrder.order_number : null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[Express Coursier Webhook Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
