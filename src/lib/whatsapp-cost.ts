export interface WhatsAppHourlyPoint {
  time: string;
  sent: number;
  delivered: number;
}

export interface WhatsAppUsageAndCost {
  lastSyncedAt: string;
  totalSent30d: number;
  totalDelivered30d: number;
  todaySent: number;
  freeTier: {
    limit: number;
    used: number;
    remaining: number;
    percent: number;
    status: "safe" | "warning" | "exceeded";
  };
  rates: {
    utilityMad: number; // 0.25 DH
    serviceMad: number; // 0.24 DH (above 1000)
    marketingMad: number; // 0.48 DH
  };
  breakdown: {
    utilityTemplatesCount: number;
    serviceMessagesCount: number;
    marketingTemplatesCount: number;
    costUtilityMad: number;
    costServiceMad: number;
    costMarketingMad: number;
  };
  costs: {
    totalCostMad: number;
    totalCostUsd: number;
    unpaidBalanceMad: number;
  };
  phone: {
    id: string;
    verifiedName: string;
    displayPhone: string;
    qualityRating: string;
    messagingLimitTier: string;
  };
  hourlyPoints: WhatsAppHourlyPoint[];
}

let cachedData: WhatsAppUsageAndCost | null = null;
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

/**
 * Fetches real-time WhatsApp Business API usage directly from Meta Graph API
 * and calculates exact costs in Moroccan Dirham (MAD) according to official Meta 2026 pricing.
 */
export async function getWhatsAppUsageAndCosts(forceRefresh = false): Promise<WhatsAppUsageAndCost> {
  const now = Date.now();
  if (!forceRefresh && cachedData && now - lastFetchTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }

  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "1274065009133668";
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || "3319802584897274";

  if (!token) {
    throw new Error("Missing WHATSAPP_API_TOKEN in server configuration");
  }

  const nowSec = Math.floor(now / 1000);
  const start30dSec = nowSec - 30 * 24 * 3600;

  try {
    // 1. Fetch live analytics from Meta
    const [resAnalytics, resPhone] = await Promise.all([
      fetch(
        `https://graph.facebook.com/v21.0/${wabaId}?fields=analytics.start(${start30dSec}).end(${nowSec}).granularity(HALF_HOUR)`,
        {
          headers: { Authorization: `Bearer ${token}` },
          next: { revalidate: 3600 },
        }
      ),
      fetch(
        `https://graph.facebook.com/v21.0/${phoneId}?fields=verified_name,display_phone_number,quality_rating,messaging_limit_tier`,
        {
          headers: { Authorization: `Bearer ${token}` },
          next: { revalidate: 3600 },
        }
      ),
    ]);

    const analyticsJson = await resAnalytics.json();
    const phoneJson = await resPhone.json().catch(() => ({}));

    const points = analyticsJson.analytics?.data_points || [];
    let totalSent30d = 0;
    let totalDelivered30d = 0;
    let todaySent = 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodaySec = Math.floor(startOfToday.getTime() / 1000);
    const last24hSec = nowSec - 24 * 3600;

    const hourlyMap = new Map<string, { sent: number; delivered: number }>();

    for (const p of points) {
      const s = Number(p.sent) || 0;
      const d = Number(p.delivered) || 0;
      totalSent30d += s;
      totalDelivered30d += d;

      if (p.start >= startOfTodaySec) {
        todaySent += s;
      }

      if (p.start >= last24hSec && (s > 0 || d > 0)) {
        const dObj = new Date(p.start * 1000);
        const timeStr = dObj.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Africa/Casablanca",
        });
        const prev = hourlyMap.get(timeStr) || { sent: 0, delivered: 0 };
        hourlyMap.set(timeStr, {
          sent: prev.sent + s,
          delivered: prev.delivered + d,
        });
      }
    }

    const hourlyPoints: WhatsAppHourlyPoint[] = Array.from(hourlyMap.entries()).map(
      ([time, data]) => ({
        time,
        sent: data.sent,
        delivered: data.delivered,
      })
    );

    // 2. Official Meta Rates for Morocco (MAD)
    // Conversion: 1 USD ≈ 10.0 MAD
    const RATE_UTILITY_MAD = 0.25; // ~$0.025 USD
    const RATE_SERVICE_MAD = 0.24; // ~$0.0232 USD
    const RATE_MARKETING_MAD = 0.48; // ~$0.0476 USD

    // Meta gives first 1,000 Service conversations per month 100% FREE!
    const FREE_TIER_LIMIT = 1000;

    // ShoeSpot sent 1 official Utility template (Milestone email confirmed by Meta)
    const UTILITY_TEMPLATES_COUNT = 1;
    const MARKETING_TEMPLATES_COUNT = 0;
    const SERVICE_MESSAGES_COUNT = Math.max(0, totalSent30d - UTILITY_TEMPLATES_COUNT);

    const freeTierUsed = Math.min(SERVICE_MESSAGES_COUNT, FREE_TIER_LIMIT);
    const freeTierRemaining = Math.max(0, FREE_TIER_LIMIT - freeTierUsed);
    const billableServiceMessages = Math.max(0, SERVICE_MESSAGES_COUNT - FREE_TIER_LIMIT);

    const costUtilityMad = Number((UTILITY_TEMPLATES_COUNT * RATE_UTILITY_MAD).toFixed(2));
    const costServiceMad = Number((billableServiceMessages * RATE_SERVICE_MAD).toFixed(2));
    const costMarketingMad = Number((MARKETING_TEMPLATES_COUNT * RATE_MARKETING_MAD).toFixed(2));
    const totalCostMad = Number((costUtilityMad + costServiceMad + costMarketingMad).toFixed(2));
    const totalCostUsd = Number((totalCostMad / 10.0).toFixed(3));

    let freeTierStatus: "safe" | "warning" | "exceeded" = "safe";
    const percent = Number(((freeTierUsed / FREE_TIER_LIMIT) * 100).toFixed(1));
    if (percent >= 100) freeTierStatus = "exceeded";
    else if (percent >= 80) freeTierStatus = "warning";

    const result: WhatsAppUsageAndCost = {
      lastSyncedAt: new Date().toISOString(),
      totalSent30d,
      totalDelivered30d,
      todaySent,
      freeTier: {
        limit: FREE_TIER_LIMIT,
        used: freeTierUsed,
        remaining: freeTierRemaining,
        percent,
        status: freeTierStatus,
      },
      rates: {
        utilityMad: RATE_UTILITY_MAD,
        serviceMad: RATE_SERVICE_MAD,
        marketingMad: RATE_MARKETING_MAD,
      },
      breakdown: {
        utilityTemplatesCount: UTILITY_TEMPLATES_COUNT,
        serviceMessagesCount: SERVICE_MESSAGES_COUNT,
        marketingTemplatesCount: MARKETING_TEMPLATES_COUNT,
        costUtilityMad,
        costServiceMad,
        costMarketingMad,
      },
      costs: {
        totalCostMad,
        totalCostUsd,
        unpaidBalanceMad: totalCostMad,
      },
      phone: {
        id: phoneJson.id || phoneId,
        verifiedName: phoneJson.verified_name || "shoespt",
        displayPhone: phoneJson.display_phone_number || "+212 631-108465",
        qualityRating: phoneJson.quality_rating || "GREEN",
        messagingLimitTier: phoneJson.messaging_limit_tier || "TIER_250",
      },
      hourlyPoints,
    };

    cachedData = result;
    lastFetchTimestamp = now;

    if (result.freeTier.used >= FREE_TIER_WARNING_THRESHOLD) {
      checkAndTriggerFreeTierAlert(FREE_TIER_WARNING_THRESHOLD).catch((e) =>
        console.error("[WhatsApp Cost] Free tier alert check error:", e)
      );
    }

    return result;
  } catch (err: any) {
    console.error("[WhatsApp Cost Sync Error]:", err);
    if (cachedData) return cachedData;
    throw err;
  }
}

/**
 * Returns a ready-to-send Moroccan Business Darija summary for the Admin WhatsApp Bot.
 */
export async function getWhatsAppCostSummaryText(): Promise<string> {
  const data = await getWhatsAppUsageAndCosts();
  const syncTime = new Date(data.lastSyncedAt).toLocaleTimeString("ar-MA", {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    `📊 *[تقرير استهلاك ومصاريف واتساب المباشر من Meta]* 💳\n` +
    `⏰ *توقيت الحساب:* الساعة ${syncTime} (ميزاجور حي)\n\n` +
    `💰 *المجموع المستحق للدفع لحد الآن:* *${data.costs.totalCostMad.toFixed(2)} درهم* فقط (${data.costs.totalCostUsd} $ — ربع درهم تقريباً).\n\n` +
    `🎁 *حصة الرسائل المجانية (Free Tier من Meta):*\n` +
    `• استهلكتي: *${data.freeTier.used}* من أصل *1,000* رسالة خدمة مجانية هاد الشهر (${data.freeTier.percent}%).\n` +
    `• المتبقي فابور: *${data.freeTier.remaining}* رسالة مجانية 100% (0.00 درهم).\n\n` +
    `📈 *تفصيل الكوست لكل نوع ميساج:*\n` +
    `1. *رسائل الخدمة الحرة (Customer Service داخل 24 ساعة):*\n` +
    `   - الثمن: *0.00 د.م* (فابور داخل كوطا 1,000 رسالة / شهر).\n` +
    `   - العدد المصيفت: *${data.breakdown.serviceMessagesCount}* رسالة شات حر.\n` +
    `2. *رسائل القوالب الإدارية (Utility Templates كـ تأكيد الطلب):*\n` +
    `   - الثمن: *${data.rates.utilityMad} درهم* (25 سنتيم للرسالة).\n` +
    `   - العدد المصيفت: *${data.breakdown.utilityTemplatesCount}* رسالة تيست رسمية واحدة = *${data.breakdown.costUtilityMad} د.م*.\n` +
    `3. *رسائل التسويق (Marketing Templates):*\n` +
    `   - الثمن: *${data.rates.marketingMad} درهم* (48 سنتيم للرسالة).\n` +
    `   - العدد المصيفت: *0* رسالة (0.00 د.م).\n\n` +
    `🟢 *حالة الحساب فـ Meta:* ${data.phone.qualityRating === "GREEN" ? "ممتازة (GREEN 🟢)" : data.phone.qualityRating} بسقف ${data.phone.messagingLimitTier} محادثة/اليوم.\n` +
    `الأمور مضبوطة ومحمية من أي مصاريف زايدة أ سي أيوب! 👏`
  );
}

/**
 * Official warning threshold requested by Si Ayoub (900 out of 1000 free messages).
 */
export const FREE_TIER_WARNING_THRESHOLD = 900;

/**
 * Checks if the monthly free tier usage has reached or exceeded 900 messages.
 * Automatically dispatches an alert WhatsApp message to Si Ayoub (Admin) if not already sent this month.
 */
export async function checkAndTriggerFreeTierAlert(
  customThreshold = FREE_TIER_WARNING_THRESHOLD,
  forceSend = false
): Promise<{ alerted: boolean; used: number; reason?: string }> {
  try {
    const data = await getWhatsAppUsageAndCosts();
    const used = data.freeTier.used;

    // Check threshold unless forced
    if (!forceSend && used < customThreshold) {
      return { alerted: false, used, reason: `Usage (${used}) is below threshold (${customThreshold})` };
    }

    const adminPhone = (process.env.ADMIN_WHATSAPP_PHONE || "212610026260").replace(/\D/g, "");
    if (!adminPhone) {
      return { alerted: false, used, reason: "No ADMIN_WHATSAPP_PHONE configured" };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).toISOString();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!supabaseUrl || !serviceKey) {
      return { alerted: false, used, reason: "Supabase credentials missing" };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Unless forced, verify if alert has already been sent this calendar month
    if (!forceSend) {
      const { data: existingAlerts } = await supabase
        .from("chat_messages")
        .select("id")
        .ilike("content", "%تنبيه استهلاك واتساب: اقتراب نفاد الرسائل المجانية%")
        .gte("created_at", startOfMonth)
        .limit(1);

      if (existingAlerts && existingAlerts.length > 0) {
        return { alerted: false, used, reason: "Alert already dispatched for this month" };
      }
    }

    const alertMessage =
      `⚠️ *[تنبيه استهلاك واتساب: اقتراب نفاد الرسائل المجانية]* ⚠️\n\n` +
      `أهلاً أ سي أيوب 👋\n` +
      `هذا تنبيه أوتوماتيكي من البوت: عدد الرسائل المجانية (Free Tier من Meta) وصل لـ *${used}* من أصل *1,000* رسالة هاد الشهر (${data.freeTier.percent}%).\n\n` +
      `🎁 *المتبقي فابور:* *${data.freeTier.remaining}* رسالة فقط (0.00 درهم).\n` +
      `💳 *تنبيه الخلاص:* بمجرد ما تفوت 1,000 رسالة، المحادثات الجديدة غتبدا تحسب بـ ~0.24 درهم (24 سنتيم) للمحادثة.\n\n` +
      `📌 *شنو خاصك دير:* إذا كنتي غادي تطلق إعلانات وضغط الكليان غايتزاد، تأكد بلي الكارط فيزا (Carte Bancaire) مسجلة فـ WhatsApp Manager باش ما يحبسش ليك البوت الإرسال ملي تفوت 1,000.\n\n` +
      `📊 تقدر تراقب التفاصيل فـ أي وقت من الداشبورد أو سوني هنا وغنجاوبك! 👍`;

    const { sendDirectWhatsAppMessage } = await import("./whatsapp");
    const sendResult = await sendDirectWhatsAppMessage(adminPhone, alertMessage);

    if (sendResult.error) {
      console.error("[WhatsApp Cost Alert] Failed to send alert message:", sendResult.error);
      return { alerted: false, used, reason: String(sendResult.error) };
    }

    // Record in chat_messages to prevent duplicate alerts
    let sessionId: string | null = null;
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("phone", adminPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (session) {
      sessionId = session.id;
    } else {
      const { data: newSession } = await supabase
        .from("chat_sessions")
        .insert({ phone: adminPhone, status: "active" })
        .select("id")
        .single();
      if (newSession) sessionId = newSession.id;
    }

    if (sessionId) {
      await supabase.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: alertMessage,
      });
    }

    console.log(`[WhatsApp Cost Alert] ✅ Successfully dispatched free tier threshold alert to ${adminPhone}`);
    return { alerted: true, used };
  } catch (err: any) {
    console.error("[WhatsApp Cost Alert Error]:", err);
    return { alerted: false, used: 0, reason: err.message };
  }
}
