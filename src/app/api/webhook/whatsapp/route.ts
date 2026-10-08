import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// We use the service role key to bypass RLS in webhooks
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
);

// In-memory cache for strict 1-to-1 message deduplication (prevents Meta webhook duplicate retries)
const processedMessageIds = new Map<string, number>();
const activeProcessingPhones = new Set<string>();
async function markMessageAsRead(messageId: string) {
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  const phone_number_id = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phone_number_id) return;

  try {
    await fetch(`https://graph.facebook.com/v21.0/${phone_number_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch (err) {
    console.error("Error marking message as read:", err);
  }
}

// Function to send an image via WhatsApp
async function sendWhatsAppImage(to: string, imageUrl: string, caption?: string) {
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  const phone_number_id = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!token || !phone_number_id) {
    console.error("Missing WhatsApp configuration");
    return;
  }

  const url = `https://graph.facebook.com/v21.0/${phone_number_id}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "image",
    image: {
      link: imageUrl,
      caption: caption || undefined,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("WhatsApp Send Image Response:", JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Error sending WhatsApp image:", error);
  }
}

// Basic function to send a WhatsApp text message
async function sendWhatsAppMessage(to: string, text: string) {
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  const phone_number_id = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!token || !phone_number_id) {
    console.error("Missing WhatsApp configuration");
    return;
  }

  const url = `https://graph.facebook.com/v21.0/${phone_number_id}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to,
    type: "text",
    text: { body: text },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("WhatsApp Send Response:", JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
  }
}

// Admin Phone Number for Technical Alerts & Bot Crashes
const ADMIN_PHONE = (process.env.ADMIN_WHATSAPP_PHONE || "212610026260").replace(/\D/g, "");

// Function to alert Admin on WhatsApp whenever any code or bot error occurs
async function notifyAdminError({
  context,
  error,
  customerPhone,
  incomingMessage,
}: {
  context: string;
  error: any;
  customerPhone?: string;
  incomingMessage?: string;
}) {
  try {
    const errString =
      error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack?.split("\n").slice(0, 4).join("\n") || ""}`
        : typeof error === "object"
        ? JSON.stringify(error, null, 2)
        : String(error);

    const timeStr = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Casablanca" });

    const alertText =
      `🚨 *تنبيه فوري: خطأ تقني في البوت (BOT ERROR ALERT)* 🚨\n\n` +
      `📍 *المكان / السياق:* ${context}\n` +
      (customerPhone ? `👤 *رقم الزبون المتأثر:* ${customerPhone}\n` : "") +
      (incomingMessage ? `💬 *الرسالة الواردة:* "${incomingMessage.slice(0, 100)}"\n` : "") +
      `⏰ *الوقت:* ${timeStr}\n\n` +
      `❌ *الخطأ التقني:*\n\`\`\`\n${errString.slice(0, 600)}\n\`\`\`\n\n` +
      `⚠️ المرجو تفقد النظام على وجه السرعة لحل المشكل.`;

    await sendWhatsAppMessage(ADMIN_PHONE, alertText);
    console.log(`[Admin Alert] Dispatched WhatsApp error alert to Admin (${ADMIN_PHONE}) for: ${context}`);
  } catch (err) {
    console.error("[Admin Alert] Failed to send WhatsApp error to admin:", err);
  }
}

// Function to download media (audio / voice notes) from WhatsApp Cloud API
async function downloadWhatsAppMedia(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  if (!token || !mediaId) return null;

  try {
    // 1. Get media URL from Meta Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const metaData = await metaRes.json();
    if (!metaData.url) {
      console.error("[WhatsApp Media] Failed to get media URL:", metaData);
      return null;
    }

    // 2. Download media bytes, safely following any redirects with Authorization header
    let targetUrl = metaData.url;
    let mediaRes = await fetch(targetUrl, {
      redirect: "manual",
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "curl/7.64.1",
      },
    });

    if (mediaRes.status >= 300 && mediaRes.status < 400) {
      const redirectLocation = mediaRes.headers.get("location");
      if (redirectLocation) {
        mediaRes = await fetch(redirectLocation, {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "curl/7.64.1",
          },
        });
      }
    }

    if (!mediaRes.ok && mediaRes.status !== 200) {
      // Direct retry with default redirect following
      mediaRes = await fetch(metaData.url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "curl/7.64.1",
        },
      });
    }

    if (!mediaRes.ok) {
      console.error("[WhatsApp Media] Download failed status:", mediaRes.status);
      return null;
    }

    const arrayBuffer = await mediaRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const rawMime = metaData.mime_type || "audio/ogg";
    const cleanMime = rawMime.split(";")[0].trim();

    return { base64, mimeType: cleanMime };
  } catch (err) {
    console.error("[WhatsApp Media] Exception downloading media:", err);
    return null;
  }
}

// Function to transcribe Moroccan Darija voice notes using Gemini Multimodal Audio
async function transcribeAudioWithGemini(
  base64Audio: string,
  mimeType: string,
  apiKey: string
): Promise<string | null> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Audio,
        },
      },
      "أنت مفرغ صوتي محترف للدارجة المغربية (Speech-to-Text). اكتب النص المنطوق في هذا الأوديو بالدارجة المغربية بدقة تامة وبدون أي مقدمات أو شرح أو إضافات. اكتب فقط ما قاله المتحدث حرفياً.",
    ]);

    const text = result.response.text().trim();
    if (!text || text.length < 2) return null;
    return text;
  } catch (err) {
    console.error("[WhatsApp Transcription] Error transcribing audio with Gemini:", err);
    notifyAdminError({
      context: "تفريغ التسجيل الصوتي (Voice Note Transcription - Gemini)",
      error: err,
    }).catch(() => {});
    return null;
  }
}

// Function to analyze images sent by customers (identifies product model and any written size)
async function analyzeIncomingImageWithGemini(
  base64Image: string,
  mimeType: string,
  apiKey: string,
  products: Array<{ id: string; name: string }>
): Promise<{ details: string; detectedSize: string | null } | null> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    const catalogBrief = products.map((p) => `- ${p.name} (معرف: ${p.id})`).join("\n");

    const prompt = `أنت خبير فحص صور أحذية رياضية لمتجر Shoespot.
الموديلات المتوفرة في المتجر هي:
${catalogBrief}

المطلوب منك:
1. هل الحذاء الظاهر في الصورة يطابق أو يشبه أحد الموديلات أعلاه؟ (مثلاً "حذاء رياضي COBRA" باللون الأسود أو "حداء new balance").
2. هل يوجد أي رقم مقاس (مثل 39, 40, 41, 42, 43, 44) مكتوب على الصورة أو في الحذاء؟

أجب بدقة باختصار شديد في سطر واحد فقط بدون مقدمات:
مثال: "حذاء رياضي COBRA (المقاس المكتوب بالصورة: 42)" أو "حداء new balance" أو "حذاء رياضي غير محدد".`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: base64Image,
        },
      },
      prompt,
    ]);

    const text = result.response.text().trim();
    if (!text) return null;

    const sizeMatch = text.match(/\b(3[8-9]|4[0-6])\b/);
    const detectedSize = sizeMatch ? sizeMatch[0] : null;

    return { details: text, detectedSize };
  } catch (err) {
    console.error("[WhatsApp Image Analysis] Error with Gemini:", err);
    notifyAdminError({
      context: "تحليل صورة الزبون (Gemini Vision Image Analysis)",
      error: err,
    }).catch(() => {});
    return null;
  }
}

const VERIFY_TOKEN = (process.env.META_VERIFY_TOKEN || "watsap_cod_token").trim();

export async function GET(req: NextRequest) {
  // Meta webhook verification
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token?.trim() === VERIFY_TOKEN) {
    console.log("Meta Webhook Verified!");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid verification token" }, { status: 403 });
}

// Helper to get or create chat session for a phone number
async function getOrCreateSession(phone: string) {
  try {
    const { data: existing } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("phone", phone)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing?.id) return existing.id;

    const { data: newSession, error } = await supabase
      .from("chat_sessions")
      .insert({ phone, status: "active" })
      .select("id")
      .single();

    if (error || !newSession) {
      console.error("Error creating chat session:", error);
      return null;
    }
    return newSession.id;
  } catch (e) {
    console.error("Exception in getOrCreateSession:", e);
    return null;
  }
}

// Helper to get recent conversation history
async function getChatHistory(sessionId: string, limit = 8) {
  try {
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(limit);

    return messages || [];
  } catch (e) {
    console.error("Error fetching chat history:", e);
    return [];
  }
}

// Helper to save a message in session history
async function saveChatMessage(sessionId: string, role: "user" | "assistant", content: string) {
  try {
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      role,
      content,
    });
  } catch (e) {
    console.error("Error saving chat message:", e);
  }
}

interface CreateOrderItemInput {
  productId?: string;
  size?: string;
  color?: string;
  quantity?: number;
}

interface CreateOrderFromWhatsAppParams {
  name: string;
  phone: string;
  city: string;
  address?: string;
  size?: string;
  color?: string;
  quantity?: number;
  productId?: string;
  items?: CreateOrderItemInput[];
}

// Robust helper to extract complete JSON objects with nested braces/brackets from a tag like [TAG: {...}]
function extractJsonObjectsFromTag(text: string, tagName: string): { jsonStr: string; fullTag: string }[] {
  const results: { jsonStr: string; fullTag: string }[] = [];
  const tagPrefix = `[${tagName}:`;
  let searchIndex = 0;

  while (true) {
    const tagStart = text.indexOf(tagPrefix, searchIndex);
    if (tagStart === -1) break;

    const firstBrace = text.indexOf("{", tagStart + tagPrefix.length);
    if (firstBrace === -1) {
      searchIndex = tagStart + tagPrefix.length;
      continue;
    }

    let depth = 0;
    let inString = false;
    let escape = false;
    let endBrace = -1;

    for (let i = firstBrace; i < text.length; i++) {
      const char = text[i];

      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === "{") depth++;
        else if (char === "}") {
          depth--;
          if (depth === 0) {
            endBrace = i;
            break;
          }
        }
      }
    }

    if (endBrace !== -1) {
      const jsonStr = text.substring(firstBrace, endBrace + 1);
      const closeBracket = text.indexOf("]", endBrace);
      const fullTag = text.substring(tagStart, closeBracket !== -1 ? closeBracket + 1 : endBrace + 1);

      results.push({ jsonStr, fullTag });
      searchIndex = closeBracket !== -1 ? closeBracket + 1 : endBrace + 1;
    } else {
      searchIndex = firstBrace + 1;
    }
  }

  return results;
}

// Helper to create order(s) in Supabase directly from WhatsApp (supports single or multi-item bundles)
async function createOrderFromWhatsApp({
  name,
  phone,
  city,
  address,
  size,
  color,
  quantity,
  productId,
  items,
}: CreateOrderFromWhatsAppParams) {
  try {
    // 1. Fetch active products
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, name, price_mad, offer_qty, offer_total_mad")
      .eq("active", true);

    if (!allProducts || allProducts.length === 0) {
      console.error("No active products found to create order");
      return null;
    }

    // 2. Normalize items list
    let itemList: CreateOrderItemInput[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      itemList = items;
    } else {
      itemList = [
        {
          productId: productId,
          size: size || "42",
          color: color,
          quantity: quantity || 1,
        },
      ];
    }

    // 3. Compute bundle pricing across all items (2 for 240 MAD = 120 MAD each)
    const totalQty = itemList.reduce((sum, it) => sum + (it.quantity || 1), 0);
    const isBundle = totalQty >= 2;
    const unitPrice = isBundle ? 120 : 150;

    // Clean phone number (format as 06... or 07...)
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("212") && cleanPhone.length === 12) {
      cleanPhone = "0" + cleanPhone.slice(3);
    }

    let resolvedName = (name || "").trim();
    let resolvedCity = (city || "").trim();
    let resolvedAddress = (address || "").trim();

    // Auto-resolve previous address, city, and name if customer said "نفس العنوان" or if missing
    if (!resolvedAddress || resolvedAddress === "نفس العنوان" || !resolvedCity || !resolvedName || resolvedName === "زبون واتساب") {
      const phone06 = cleanPhone;
      const phone212 = cleanPhone.startsWith("0") ? "212" + cleanPhone.slice(1) : cleanPhone;
      const { data: prevOrders } = await supabase
        .from("orders")
        .select("customer_name, city, district, landmark")
        .or(`phone.eq.${phone06},phone.eq.${phone212}`)
        .order("created_at", { ascending: false })
        .limit(1);

      if (prevOrders && prevOrders.length > 0) {
        const prev = prevOrders[0];
        if (!resolvedName || resolvedName === "زبون واتساب") resolvedName = prev.customer_name || "زبون واتساب";
        if (!resolvedCity) resolvedCity = prev.city || "المغرب";
        if (!resolvedAddress || resolvedAddress === "نفس العنوان") {
          resolvedAddress = [prev.district, prev.landmark].filter(Boolean).join(" - ").trim() || prev.city;
        }
      }
    }

    if (!resolvedName) resolvedName = "زبون واتساب";
    if (!resolvedCity) resolvedCity = "المغرب";

    // Build normalized order items list with full details (name, photo, size, color)
    const orderItems: Array<{
      productId: string;
      name: string;
      size: string;
      color: string | null;
      quantity: number;
      priceMad: number;
      imageUrl: string | null;
    }> = [];

    for (let i = 0; i < itemList.length; i++) {
      const it = itemList[i];
      const targetPid = it.productId || (it as any).product_id;
      let matchedProduct = allProducts.find((p) => p.id === targetPid);
      if (!matchedProduct && targetPid) {
        const pLower = String(targetPid).toLowerCase();
        matchedProduct = allProducts.find(
          (p) =>
            p.name.toLowerCase().includes(pLower) ||
            (pLower.includes("cobra") && p.name.toLowerCase().includes("cobra")) ||
            (pLower.includes("balance") && p.name.toLowerCase().includes("balance"))
        );
      }
      if (!matchedProduct) {
        matchedProduct = allProducts[i] || allProducts[0];
      }

      const sizeMatch = String(it.size || "").match(/\b(3[8-9]|4[0-6])\b/);
      const cleanSize = sizeMatch ? sizeMatch[0] : (it.size || "42").trim();

      orderItems.push({
        productId: matchedProduct.id,
        name: matchedProduct.name,
        size: cleanSize,
        color: it.color || null,
        quantity: it.quantity || 1,
        priceMad: unitPrice,
        imageUrl: (matchedProduct as any).image_urls?.[0] || null,
      });
    }

    const primaryProduct = allProducts.find((p) => p.id === orderItems[0]?.productId) || allProducts[0];
    const totalOrderQty = orderItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
    const combinedSizes = orderItems.map((item) => item.size).join(" / ");
    const combinedColors = orderItems.map((item) => item.color).filter(Boolean).join(" / ");

    const bundleSummary = isBundle
      ? `[عرض ${totalOrderQty} أحذية: ${orderItems.map((item) => `${item.name} مقاس ${item.size}${item.color ? ' (' + item.color + ')' : ''}`).join(" + ")}]`
      : `[${primaryProduct.name} مقاس ${orderItems[0]?.size || "42"}]`;

    const notesContent = resolvedAddress
      ? `العنوان: ${resolvedAddress} - ${bundleSummary}`
      : `تم الطلب والتأكيد عبر واتساب بوت - ${bundleSummary}`;

    const insertPayload: any = {
      customer_name: resolvedName,
      phone: cleanPhone,
      city: resolvedCity,
      district: resolvedAddress || null,
      product_id: primaryProduct.id,
      size: combinedSizes,
      color: combinedColors || null,
      quantity: totalOrderQty,
      unit_price_mad: unitPrice,
      payment_method: "cod",
      status: "confirmed_continuous",
      confirmed_at: new Date().toISOString(),
      notes: notesContent,
      items: orderItems,
    };

    let createdOrder: { id: string; order_number: number } | null = null;
    const { data: oWithItems, error: errWithItems } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select("id, order_number")
      .single();

    if (!errWithItems && oWithItems) {
      createdOrder = oWithItems;
    } else {
      // If items column doesn't exist yet, insert without items column
      delete insertPayload.items;
      const { data: oFallback, error: errFallback } = await supabase
        .from("orders")
        .insert(insertPayload)
        .select("id, order_number")
        .single();

      if (errFallback || !oFallback) {
        console.error("Error creating single order from WhatsApp:", errFallback);
        notifyAdminError({
          context: "إنشاء طلبية في قاعدة البيانات (Supabase Order Insert Error)",
          error: errFallback || "No order returned",
          customerPhone: cleanPhone,
        }).catch(() => {});
        return null;
      }
      createdOrder = oFallback;
    }

    // Insert single order event
    await supabase.from("order_events").insert({
      order_id: createdOrder.id,
      type: "created",
      detail: {
        source: "whatsapp_bot",
        channel: "meta_cloud_api",
        is_bundle: isBundle,
        total_items: orderItems.length,
        items: orderItems,
      },
    });

    console.log(`[Order Created] Order #${createdOrder.order_number} (${bundleSummary}) registered from WhatsApp for ${resolvedName} (${cleanPhone})!`);

    return {
      orderNumber: createdOrder.order_number,
      orderId: createdOrder.id,
      orderNumbers: [createdOrder.order_number],
      orderIds: [createdOrder.id],
    };
  } catch (err) {
    console.error("Exception creating order:", err);
    notifyAdminError({
      context: "استثناء أثناء تسجيل الطلبية (createOrderFromWhatsApp Exception)",
      error: err,
      customerPhone: phone,
    }).catch(() => {});
    return null;
  }
}

// Helper to log customer complaints / reclamations into Supabase
async function logReclamationFromWhatsApp({
  name,
  phone,
  type,
  issue,
}: {
  name?: string;
  phone: string;
  type?: string;
  issue: string;
}) {
  try {
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("212") && cleanPhone.length === 12) {
      cleanPhone = "0" + cleanPhone.slice(3);
    }

    const { data, error } = await supabase
      .from("reclamations")
      .insert({
        customer_name: (name || "زبون").trim(),
        phone: cleanPhone,
        type: type || "other",
        issue: issue.trim(),
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[Reclamation] Table might not exist or error:", error.message);
      // Fallback: flag session as handed_to_human so merchant sees it
      await supabase
        .from("chat_sessions")
        .update({
          status: "handed_to_human",
          updated_at: new Date().toISOString(),
        })
        .eq("phone", phone);
    }

    console.log(`[Reclamation Logged] Claim recorded for ${cleanPhone}: "${issue.slice(0, 50)}"`);
    return data?.id || null;
  } catch (err) {
    console.error("Error logging reclamation:", err);
    return null;
  }
}

// ==========================================
// 👑 EXECUTIVE ADMIN ASSISTANT HANDLER
// ==========================================
async function handleAdminWhatsAppMessage({
  from,
  msg_body,
  isVoiceNote,
  sessionId,
  history,
}: {
  from: string;
  msg_body: string;
  isVoiceNote: boolean;
  sessionId: string | null;
  history: Array<{ role: string; content: string }>;
}): Promise<NextResponse> {
  try {
    const apiKey = process.env.AI_API_KEY?.trim() || "";
    if (!apiKey) {
      console.error("[Admin Assistant] Missing AI_API_KEY");
      await sendWhatsAppMessage(from, "عذراً سي أيوب، مفتاح AI_API_KEY غير موجود في الخادم.");
      return NextResponse.json({ status: "ADMIN_ERROR" }, { status: 200 });
    }

    // 1. Time & Date in Casablanca
    const nowCasablanca = new Date().toLocaleString("en-CA", {
      timeZone: "Africa/Casablanca",
      hour12: false,
    });
    const todayDateStr = nowCasablanca.split(",")[0].trim(); // "YYYY-MM-DD"
    const todayStartUtc = new Date(`${todayDateStr}T00:00:00+01:00`).toISOString();
    const timeDisplay = new Date().toLocaleTimeString("ar-MA", {
      timeZone: "Africa/Casablanca",
      hour: "2-digit",
      minute: "2-digit",
    });

    // 2. Search for any specific order number or phone mentioned in msg_body
    let specificOrder: any = null;
    const orderNumMatches = msg_body.match(/#?(\b\d{1,5}\b)/g);
    const phoneMatch = msg_body.match(/(0[67]\d{8})/);

    if (orderNumMatches) {
      for (const match of orderNumMatches) {
        const cleanNum = parseInt(match.replace("#", ""), 10);
        if (!isNaN(cleanNum) && cleanNum > 0 && cleanNum < 100000) {
          const { data: ord } = await supabase
            .from("orders")
            .select("*, product:product_id(name)")
            .eq("order_number", cleanNum)
            .maybeSingle();
          if (ord) {
            specificOrder = ord;
            break;
          }
        }
      }
    }

    if (!specificOrder && phoneMatch) {
      const ph = phoneMatch[1];
      const { data: ords } = await supabase
        .from("orders")
        .select("*, product:product_id(name)")
        .or(`phone.eq.${ph},phone.eq.212${ph.slice(1)}`)
        .order("created_at", { ascending: false })
        .limit(1);
      if (ords && ords.length > 0) {
        specificOrder = ords[0];
      }
    }

    // 3. Parallel Live Database Queries
    const [
      todayOrdersRes,
      totalOrdersCountRes,
      recentOrdersRes,
      reclamationsRes,
      productsRes,
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, status, unit_price_mad, quantity, items, created_at")
        .gte("created_at", todayStartUtc),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("orders")
        .select("id, order_number, customer_name, phone, city, district, status, unit_price_mad, quantity, items, size, color, created_at, tracking, notes, product:product_id(name)")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("reclamations")
        .select("id, customer_name, phone, type, issue, status, created_at, admin_notes")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("products")
        .select("id, name, price_mad, stock_by_size, active, sizes, colors")
        .eq("active", true),
    ]);

    const todayOrders = todayOrdersRes.data || [];
    const totalOrdersCount = totalOrdersCountRes.count || 0;
    const recentOrders = recentOrdersRes.data || [];
    const allReclamations = reclamationsRes.data || [];
    const activeProducts = productsRes.data || [];

    // Calculate metrics
    const todayStatusMap: Record<string, number> = {};
    let todayRevenueMad = 0;
    for (const ord of todayOrders) {
      todayStatusMap[ord.status] = (todayStatusMap[ord.status] || 0) + 1;
      if (["new", "confirmed", "confirmed_continuous", "shipped", "delivered"].includes(ord.status)) {
        if (Array.isArray(ord.items) && ord.items.length > 0) {
          const itSum = ord.items.reduce(
            (s: number, it: any) => s + (Number(it.priceMad || it.price_mad || it.price) || 0) * (Number(it.quantity) || 1),
            0
          );
          todayRevenueMad += itSum > 0 ? itSum : (Number(ord.unit_price_mad) || 0) * (Number(ord.quantity) || 1);
        } else {
          todayRevenueMad += (Number(ord.unit_price_mad) || 0) * (Number(ord.quantity) || 1);
        }
      }
    }

    const pendingRecs = allReclamations.filter((r) => r.status === "pending" || r.status === "contacted");

    // Format recent orders text
    const recentOrdersText = recentOrders.length > 0
      ? recentOrders.map((o) => {
          const time = new Date(o.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });
          const date = new Date(o.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Africa/Casablanca" });
          let itemsDesc = "";
          if (Array.isArray(o.items) && o.items.length > 0) {
            itemsDesc = o.items.map((it: any) => `${it.name || 'سبرديلة'} (نمرة ${it.size}${it.color ? `, لون ${it.color}` : ''})`).join(" + ");
          } else {
            itemsDesc = `${o.product?.name || 'سبرديلة'} (نمرة ${o.size}${o.color ? `, لون ${o.color}` : ''})`;
          }
          const totalMad = (Number(o.unit_price_mad) || 0) * (Number(o.quantity) || 1);
          return `• الطلبية #${o.order_number} | الزبون: ${o.customer_name} | الهاتف: ${o.phone} | المدينة: ${o.city} | الحالة: [${o.status}] | الثمن: ${totalMad} درهم | السلعة: ${itemsDesc} | الوقت: ${date} ${time}${o.notes ? ` | ملاحظة: ${o.notes}` : ''}`;
        }).join("\n")
      : "لا توجد أي طلبيات مسجلة بعد.";

    // Format reclamations text
    const recsText = allReclamations.length > 0
      ? allReclamations.map((r) => {
          return `• شكاية (${r.type}): الزبون ${r.customer_name} (${r.phone}) | الحالة: [${r.status}] | المشكل: "${r.issue}"`;
        }).join("\n")
      : "لا توجد أي شكايات مسجلة في النظام (0 شكايات).";

    // Format products & stock text
    const productsText = activeProducts.map((p) => {
      let stockSummary = "";
      if (p.stock_by_size && typeof p.stock_by_size === "object") {
        stockSummary = Object.entries(p.stock_by_size)
          .map(([size, qty]) => `${size}: ${qty}`)
          .join(", ");
      } else {
        stockSummary = "متوفر بجميع المقاسات";
      }
      return `• ${p.name} | الثمن: ${p.price_mad} درهم | المخزون حسب النمرة: [${stockSummary}]`;
    }).join("\n");

    let specificOrderText = "";
    if (specificOrder) {
      let itemDetails = "";
      if (Array.isArray(specificOrder.items) && specificOrder.items.length > 0) {
        itemDetails = specificOrder.items.map((it: any) => `${it.name || 'حذاء'} مقاس ${it.size}`).join(" و ");
      } else {
        itemDetails = `${specificOrder.product?.name || 'حذاء'} مقاس ${specificOrder.size}`;
      }
      specificOrderText = `\n🎯 نتيجة البحث المباشر عن الطلبية المستفسر عنها:
- رقم الطلبية: #${specificOrder.order_number}
- اسم الزبون: ${specificOrder.customer_name}
- الهاتف: ${specificOrder.phone}
- المدينة: ${specificOrder.city} - ${specificOrder.district || ''}
- الحالة الحالية: ${specificOrder.status}
- السلعة: ${itemDetails}
- الثمن الإجمالي: ${(Number(specificOrder.unit_price_mad) || 0) * (Number(specificOrder.quantity) || 1)} درهم
- تاريخ الطلب: ${specificOrder.created_at}
- الملاحظات: ${specificOrder.notes || 'لا توجد'}\n`;
    }

    const historyText = history.length > 0
      ? history.map((m) => `${m.role === "user" ? "سي أيوب (الأدمين)" : "أنت (المساعد)"}: ${m.content}`).join("\n")
      : "(هذه بداية المحادثة مع سي أيوب)";

    const adminPrompt = `أنت "المساعد التنفيذي والإداري والتقني الذكي" لمتجر Shoespot، وتتحدث مباشرة وفقط مع صاحب المتجر والمدير العام: "سي أيوب" (الأدمين / الشاف) عبر الواتساب.

🚨 قواعد صارمة ومقدسة في وضع الأدمين (EXECUTIVE ADMIN MODE):
1. أنت لست في وضع بيع زبائن!
   - 🛑 ممنوع منعاً كلياً وباتاً أن تعامل سي أيوب كزبون عادي!
   - 🛑 ممنوع تسأله عن النمرة (المقاس) ديالو، وممنوع تقترح عليه يشري سبرديلة، وممنوع تسأله عن العنوان أو المدينة ديال التوصيل!
   - 🛑 ممنوع نهائياً استخدام تاغات الزبائن مثل [CREATE_ORDER] أو إرسال صور السلع للبيع أو تاغات الصور.

2. أسلوب التخاطب:
   - تحدث بالدارجة المغربية الإدارية والعملية والمحترمة (Business Darija).
   - ناديه بتقدير: "سي أيوب"، "أ شاف"، "خويا أيوب".
   - كن سريع البديهة، دقيقاً في الأرقام، ملخصاً ومباشراً بدون إطالة فارغة.
   - إذا أرسل لك تسجيل صوتي (أوديو) أو رسالة مكتوبة، جاوبه بدقة كاملة على كل ما طلبه.

3. معطيات المتجر الحية الآن (LIVE STORE METRICS):
📅 التاريخ والوقت في المغرب: ${todayDateStr} الساعة ${timeDisplay}
📦 إجمالي الطلبيات المسجلة في النظام: ${totalOrdersCount} طلبية
📊 طلبيات اليوم (${todayDateStr}): ${todayOrders.length} طلبية
💰 مداخيل اليوم التقديرية: ${todayRevenueMad} درهم
📈 تفصيل حالات طلبيات اليوم: ${JSON.stringify(todayStatusMap)}
⚠️ الشكايات العالقة المعلقة (Pending): ${pendingRecs.length} شكايات

---
قائمة آخر الطلبيات في النظام:
${recentOrdersText}
---
وضعية الشكايات والروتور:
${recsText}
---
وضعية المنتجات والمخزون (السطوك):
${productsText}
---
${specificOrderText}

4. سجل المحادثة السابقة مع سي أيوب:
${historyText}

5. الرسالة الواردة الحالية من سي أيوب:
${isVoiceNote ? `🎙️ [أرسلها سي أيوب عبر تسجيل صوتي/أوديو بالدارجة]: "${msg_body}"` : `💬 [رسالة مكتوبة]: "${msg_body}"`}

6. مهامك وصلاحياتك:
• إذا سألك عن حالة الطلبيات أو المبيعات أو اليوم شنو داز: قدم له ملخصاً تنفيذياً سريعاً ومرتباً بالإيموجي.
• إذا سألك عن طلبية معينة (برقمها أو باسم الزبون أو هاتفه): أعطه كل تفاصيلها فوراً.
• إذا سألك عن الشكايات (الريكلاماسيون) أو مشاكل التوصيل: لخص له الشكايات العالقة وأرقام الكليان.
• إذا سألك عن السطوك: اذكر له السلعة المتوفرة أو الناقصة.
• إذا سألك عن الأعطال والسيستيم التقني والكود:
  - طمئنه بأن السيستيم والويب هوك والذكاء الاصطناعي شغال 100% وبدون أعطال.
  - إذا سألك عن الكود أو الإضافات: اشرح له بلغة واضحة ما تم تطويره (دمج طلبيات العروض في طلبية واحدة في قاعدة البيانات، نظام تفاصيل الطلب برقم الهاتف والواتساب المباشر، نظام تسجيل الشكايات التلقائي، واجهات الإدارة المتطورة).
• ⚡ تنفيذ الأوامر الإدارية (ADMIN COMMANDS):
  - إذا أمرك بتعديل حالة طلبية، مثل: "بدل الطلبية 21 لـ confirmed"، "لغي الطلب 25"، "دير للطلب 21 shipped":
    أكد له التنفيذ في ردك، وأضف التاغ التالي حصراً في نهاية الرسالة:
    [UPDATE_ORDER_STATUS: {"order_number": رقم_الطلبية, "status": "الحالة_الجديدة", "note": "تعديل عبر واتساب بواسطة سي أيوب"}]
    الحالات المسموحة: (new, confirmed, confirmed_continuous, no_answer, retry, postponed, canceled, shipped, delivered, returned)
  - إذا أمرك بحل شكاية:
    [UPDATE_RECLAMATION: {"id": "معرف_الشكاية", "status": "resolved"}]

أجب الآن بالدارجة المغربية بأسلوب تنفيذي ومحترم ومباشر لسي أيوب.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    const result = await model.generateContent(adminPrompt);
    let aiResponse = result.response.text();

    console.log(`[Admin Assistant] Reply for Si Ayoub:\n${aiResponse}`);

    // Parse and execute UPDATE_ORDER_STATUS tags
    const statusTags = extractJsonObjectsFromTag(aiResponse, "UPDATE_ORDER_STATUS");
    for (const tag of statusTags) {
      try {
        const parsed = JSON.parse(tag.jsonStr);
        const orderNum = parsed.order_number;
        const newStatus = parsed.status;
        if (orderNum && newStatus) {
          const { data: ord } = await supabase
            .from("orders")
            .select("id, status")
            .eq("order_number", orderNum)
            .maybeSingle();

          if (ord) {
            const updates: any = { status: newStatus };
            if (newStatus === "confirmed" || newStatus === "confirmed_continuous") updates.confirmed_at = new Date().toISOString();
            if (newStatus === "shipped") updates.shipped_at = new Date().toISOString();
            if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();
            if (parsed.note) updates.notes = parsed.note;

            await supabase.from("orders").update(updates).eq("id", ord.id);
            await supabase.from("order_events").insert({
              order_id: ord.id,
              type: "status_change",
              detail: {
                old_status: ord.status,
                new_status: newStatus,
                source: "admin_whatsapp",
                by: "Ayoub",
                note: parsed.note || "Updated via WhatsApp by Admin",
              },
            });
            console.log(`[Admin Action] Order #${orderNum} status updated to ${newStatus}`);
          }
        }
        aiResponse = aiResponse.replace(tag.fullTag, "");
      } catch (err) {
        console.error("Error updating order status from admin tag:", err);
      }
    }

    // Parse and execute UPDATE_RECLAMATION tags
    const recTags = extractJsonObjectsFromTag(aiResponse, "UPDATE_RECLAMATION");
    for (const tag of recTags) {
      try {
        const parsed = JSON.parse(tag.jsonStr);
        if (parsed.id) {
          await supabase.from("reclamations").update({
            status: parsed.status || "resolved",
            admin_notes: parsed.note || "Resolved by Admin via WhatsApp",
            updated_at: new Date().toISOString(),
          }).eq("id", parsed.id);
        }
        aiResponse = aiResponse.replace(tag.fullTag, "");
      } catch (err) {
        console.error("Error updating reclamation from admin tag:", err);
      }
    }

    const cleanAdminReply = aiResponse
      .replace(/\[UPDATE_ORDER_STATUS:\s*\{[\s\S]*?\}\]/gi, "")
      .replace(/\[UPDATE_RECLAMATION:\s*\{[\s\S]*?\}\]/gi, "")
      .replace(/\[SEND_IMAGE:\s*https?:\/\/[^\s\]]+\]/gi, "")
      .trim();

    // Save assistant response to session history
    if (sessionId) {
      await saveChatMessage(sessionId, "assistant", cleanAdminReply);
    }

    // Send WhatsApp text message to Admin
    await sendWhatsAppMessage(from, cleanAdminReply);

    return NextResponse.json({ status: "ADMIN_REPLY_SENT" }, { status: 200 });
  } catch (err) {
    console.error("[Admin Assistant Error]", err);
    await sendWhatsAppMessage(
      from,
      `سمح لي سي أيوب، وقع واحد الخطأ تقني فالاستجابة: ${err instanceof Error ? err.message : String(err)}`
    );
    return NextResponse.json({ status: "ADMIN_ERROR_HANDLED" }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.object) {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messages = value?.messages;

      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from;
        const messageId = message.id;
        let msg_body = message.text?.body;
        const isAudio = message.type === "audio" || message.type === "voice" || !!message.audio || !!message.voice;
        const isImage = message.type === "image" || !!message.image;
        let isVoiceNote = false;
        let isImageMessage = false;

        // 🛑 STRICT 1-TO-1 DEDUPLICATION 1: Meta Message ID (wamid)
        if (messageId) {
          const now = Date.now();
          for (const [id, timestamp] of processedMessageIds.entries()) {
            if (now - timestamp > 10 * 60 * 1000) processedMessageIds.delete(id);
          }

          if (processedMessageIds.has(messageId)) {
            console.log(`[WhatsApp Bot] Duplicate webhook ignored for message ID: ${messageId}`);
            return NextResponse.json({ status: "DUPLICATE_IGNORED" }, { status: 200 });
          }
          processedMessageIds.set(messageId, now);
        }

        // 🛑 STRICT 1-TO-1 DEDUPLICATION 2: Active Phone Lock (prevents concurrent duplicate runs)
        if (activeProcessingPhones.has(from)) {
          console.log(`[WhatsApp Bot] Concurrent execution in progress for ${from}. Ignoring duplicate.`);
          return NextResponse.json({ status: "CONCURRENT_IGNORED" }, { status: 200 });
        }

        activeProcessingPhones.add(from);

        try {
          console.log(`[WhatsApp Webhook] Received message from ${from}: ${msg_body || `[${message.type || "unknown"} message]`}`);

          // Mark as read
          if (messageId) {
            markMessageAsRead(messageId).catch(() => {});
          }

          if (isAudio) {
            const audioObj = message.audio || message.voice;
            const mediaId = audioObj?.id || (message[message.type]?.id);

            if (mediaId) {
              console.log(`[WhatsApp Bot] Downloading audio media ${mediaId} from Meta...`);
              const audioData = await downloadWhatsAppMedia(mediaId);
              if (audioData) {
                const apiKey = process.env.AI_API_KEY?.trim() || "";
                console.log(`[WhatsApp Bot] Transcribing audio with Gemini...`);
                const transcribedText = await transcribeAudioWithGemini(audioData.base64, audioData.mimeType, apiKey);
                if (transcribedText) {
                  console.log(`[WhatsApp Bot] Audio Transcribed successfully: "${transcribedText}"`);
                  msg_body = transcribedText;
                  isVoiceNote = true;
                }
              }
            }

            if (!msg_body) {
              console.log(`[WhatsApp Bot] Audio inaudible/garbled or failed. Sending polite request.`);
              const fallback = "سمح لي أخويا، الصوت ما واضحش مزيان فـ هاد الأوديو (مخرشش شوية)، عفاك عاود صيفط ليا أوديو واضح ولا كتب ليا فـ ميساج باش نجاوبك مزيان 🙏";
              await sendWhatsAppMessage(from, fallback);
              return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
            }
          } else if (isImage) {
            const imageObj = message.image;
            const caption = imageObj?.caption?.trim() || "";
            const mediaId = imageObj?.id || (message[message.type]?.id);

            let imageAnalysisText = "";
            if (mediaId) {
              console.log(`[WhatsApp Bot] Downloading customer image ${mediaId} from Meta...`);
              const imageData = await downloadWhatsAppMedia(mediaId);
              if (imageData) {
                const apiKey = process.env.AI_API_KEY?.trim() || "";
                const { data: prods } = await supabase.from("products").select("id, name").eq("active", true);
                const analysis = await analyzeIncomingImageWithGemini(imageData.base64, imageData.mimeType, apiKey, prods || []);
                if (analysis?.details) {
                  imageAnalysisText = analysis.details;
                  console.log(`[WhatsApp Bot] Image analyzed with Gemini: "${imageAnalysisText}"`);
                }
              }
            }

            if (imageAnalysisText && caption) {
              msg_body = `🖼️ [صورة أرسلها الزبون لموديل: ${imageAnalysisText}] مع تعليق مرفق: "${caption}"`;
            } else if (imageAnalysisText) {
              msg_body = `🖼️ [صورة أرسلها الزبون لموديل: ${imageAnalysisText}]`;
            } else if (caption) {
              msg_body = `🖼️ [صورة حذاء أرسلها الزبون] مع تعليق مرفق: "${caption}"`;
            } else {
              msg_body = `🖼️ [أرسل الزبون صورة حذاء يسأل عن توفره ومقاساته في المتجر]`;
            }
            isImageMessage = true;
          }

          if (msg_body) {
            try {
              // 1. Get or create chat session for this customer
              const sessionId = await getOrCreateSession(from);
              const userHistoryMsg = isVoiceNote
                ? `🎙️ [أوديو]: "${msg_body}"`
                : msg_body;

              // 🛑 STRICT 1-TO-1 DEDUPLICATION 3: Database check (prevents duplicate retries across lambdas)
              if (sessionId) {
                const { data: recentMsgs } = await supabase
                  .from("chat_messages")
                  .select("content, created_at")
                  .eq("session_id", sessionId)
                  .eq("role", "user")
                  .order("created_at", { ascending: false })
                  .limit(1);

                if (recentMsgs && recentMsgs.length > 0) {
                  const lastMsg = recentMsgs[0];
                  const timeDiff = Date.now() - new Date(lastMsg.created_at).getTime();
                  if (lastMsg.content === userHistoryMsg && timeDiff < 25000) {
                    console.log(`[WhatsApp Bot] Database duplicate detected for ${from} within ${timeDiff}ms. Ignoring.`);
                    return NextResponse.json({ status: "DUPLICATE_IGNORED" }, { status: 200 });
                  }
                }
              }

              // 2. Fetch conversation history
              const history = sessionId ? await getChatHistory(sessionId, 8) : [];

              // 3. Save incoming user message
              if (sessionId) {
                await saveChatMessage(sessionId, "user", userHistoryMsg);
              }

            // 4. Fetch live bot settings, products, and customer order history from Supabase
            let cleanPhone = from.replace(/\D/g, "");
            let phone06 = cleanPhone;
            let phone212 = cleanPhone;
            if (cleanPhone.startsWith("212") && cleanPhone.length === 12) {
              phone06 = "0" + cleanPhone.slice(3);
            } else if (cleanPhone.startsWith("0") && cleanPhone.length === 10) {
              phone212 = "212" + cleanPhone.slice(1);
            }

            // 👑 ADMIN RECOGNITION: Si Ayoub (0610026260 / 212610026260)
            const adminClean = ADMIN_PHONE.replace(/\D/g, "");
            const isAdmin =
              cleanPhone === "212610026260" ||
              phone06 === "0610026260" ||
              cleanPhone === adminClean ||
              (adminClean.startsWith("212") && phone06 === "0" + adminClean.slice(3)) ||
              (adminClean.startsWith("0") && phone212 === "212" + adminClean.slice(1));

            if (isAdmin) {
              console.log(`[WhatsApp Bot] 👑 ADMIN RECOGNIZED (${from}) -> Activating Executive Admin Assistant Mode`);
              return await handleAdminWhatsAppMessage({
                from,
                msg_body,
                isVoiceNote,
                sessionId,
                history,
              });
            }

            const [botSettingsRes, productsRes, previousOrdersRes] = await Promise.all([
              supabase.from("bot_settings").select("*").limit(1).single(),
              supabase.from("products").select("*").eq("active", true),
              supabase
                .from("orders")
                .select("customer_name, city, district, landmark, size, color, created_at")
                .or(`phone.eq.${phone06},phone.eq.${phone212}`)
                .order("created_at", { ascending: false })
                .limit(2),
            ]);

            const botSettings = botSettingsRes.data;
            const products = productsRes.data || [];
            const previousOrders = previousOrdersRes.data || [];
            const lastOrder = previousOrders.length > 0 ? previousOrders[0] : null;

            const previousCustomerName = lastOrder?.customer_name?.trim();
            const previousCity = lastOrder?.city?.trim();
            const previousAddress = [lastOrder?.district, lastOrder?.landmark].filter(Boolean).join(" - ").trim() || previousCity;

            let customerProfileText = "";
            if (lastOrder && previousCustomerName && previousCity) {
              customerProfileText = `🌟 ملف هذا الزبون في النظام (زبون سابق مسجل لديه طلبيات سابقة):
- الاسم المسجل: ${previousCustomerName}
- المدينة المسجلة: ${previousCity}
- العنوان السابق المسجل: ${previousAddress}
- رقم الهاتف: ${phone06}
⚠️ أولوية قصوى للمقاس (النمرة): ممنوع نهائياً الاعتماد على أي مقاس قديم طلبه هذا الزبون في طلبيات سابقة! خذ دائماً المقاس الجديد الذي يطلبه الزبون في هذه المحادثة الحالية حصراً (لأن الزبائن يشترون أحياناً لأنفسهم أو لأبنائهم أو لأقاربهم بمقاسات مختلفة).`;
            } else {
              customerProfileText = `🌟 حالة هذا الزبون: زبون جديد (لا توجد طلبيات سابقة مسجلة له برقم الهاتف ${phone06}).`;
            }

            // Format product catalog for AI prompt with live stock and sizes
            const catalogText = products
              .map((p) => {
                // Determine available sizes from BOTH stock_by_size AND p.sizes
                const stockSizes: string[] = [];
                if (p.stock_by_size && typeof p.stock_by_size === "object") {
                  for (const [sKey, qty] of Object.entries(p.stock_by_size)) {
                    const qStr = String(qty ?? "").trim();
                    const qNum = parseInt(qStr, 10);
                    if ((!isNaN(qNum) && qNum > 0) || (qStr !== "" && qStr !== "0" && qStr !== "-")) {
                      stockSizes.push(sKey);
                    }
                  }
                }
                const explicitSizes = Array.isArray(p.sizes) ? p.sizes : [];
                const combinedSizes = Array.from(new Set([...stockSizes, ...explicitSizes])).sort((a, b) => {
                  const na = parseInt(a, 10);
                  const nb = parseInt(b, 10);
                  if (!isNaN(na) && !isNaN(nb)) return na - nb;
                  return a.localeCompare(b);
                });

                const colorsList = Array.isArray(p.colors)
                  ? p.colors.map((c: any) => (typeof c === "object" ? c.name : c)).join(", ")
                  : "";
                const sizesList = combinedSizes.length > 0 ? combinedSizes.join(", ") : "متوفر بجميع المقاسات";
                const offer = p.offer_qty && p.offer_total_mad
                  ? `عرض خاص: ${p.offer_qty} بـ ${p.offer_total_mad} درهم`
                  : "";
                const img = p.image_urls?.[0] || "";

                return `• اسم الموديل: ${p.name}
  معرف الموديل (ID): ${p.id}
  الثمن: ${p.price_mad} درهم ${p.old_price_mad ? `(الثمن قبل التخفيض: ${p.old_price_mad} درهم)` : ""}
  ${offer ? `  ${offer}` : ""}
  المقاسات المتوفرة في المخزون: ${sizesList}
  الألوان المتوفرة: ${colorsList || "غير محددة"}
  الوصف: ${p.description || ""}
  رابط الصورة المباشر: ${img}`;
              })
              .join("\n\n");

            const customInstruction = botSettings?.system_prompt?.trim() || `أنت مساعد ذكي لمتجر إلكتروني مغربي (الدفع عند الاستلام).
جاوب الزبائن بالدارجة المغربية بأسلوب لطيف ومحترم ومباشر.
شرح المنتجات وساعد الكليان يدوز الطلبية ديالو.`;

            // Format history text for Gemini
            const historyText = history.length > 0
              ? history
                  .map((m) => `${m.role === "user" ? "الزبون" : "أنت (المساعد)"}: ${m.content}`)
                  .join("\n")
              : "(هذه بداية المحادثة، لا توجد رسائل سابقة)";

            const userPromptText = isVoiceNote
              ? `الرسالة الحالية من الزبون (أرسلها الزبون عبر تسجيل صوتي/أوديو بالدارجة المغربية): "${msg_body}"`
              : `الرسالة الحالية الجديدة من الزبون: "${msg_body}"`;

            const prompt = `${customInstruction}

---
كتالوج المنتجات والموديلات المتوفرة حالياً في المتجر:
${catalogText}
---

${customerProfileText}
---

سجل المحادثة السابقة مع هذا الزبون (رقم هاتفه: ${from}):
${historyText}
---

${userPromptText}

قواعد صارمة جداً لإدارة الرد وتأكيد الطلبيات (CONFIRMATION METHODOLOGY):
0. الهوية البشرية والصدق التجاري:
   - أنت إنسان حقيقي وتاجر مغربي من متجر Shoespot ("أنا معاك فالمحل أخويا"). ممنوع منعاً كلياً أن تذكر أنك روبوت أو ذكاء اصطناعي.
   - ممنوع نهائياً تقول على السبرديلة أنها "أصلية" أو "أوريجينال" لأنها ليست أصلية الماركة العالمية!
   - إذا سألك الكليان "واش أصلية/أوريجينال؟" جاوبو بصراحة: "لا أخويا ماشي أوريجينال، ولكن سلعة نقية بزاف وجودتها ممتازة، سوميلة ݣومة حقيقية، خياطة صحيحة من الداخل، ومخدومة بلانجيكسيون، وفوق هادشي كتقلب السلعة بعينيك عاد كتخلص!".
   - ركز دائماً على: "سلعة نقية"، "جودة ممتازة"، "فينيسيون متقونة".

1. الأسعار الثابتة وممنوع التفاوض نهائياً:
   • 1 سبرديلة: 150 درهم فقط.
   • عرض خاص (2 سبرديلات): 240 درهم فقط (120 درهم للحبة، توفير 60 درهم).
   • التوصيل: فابور (مجاني 100%) لجميع المدن والدفع عند الاستلام بعد معاينة السلعة وتفقدها.
   • ممنوع التفاوض: إذا طلب تخفيض، اشرح له بلباقة أن السعر ثابت ومناسب واقترح عرض الحبتين (2 بـ 240 درهم).
   • الرد على اعتراض "لقيتها فـ بلاصة خرى بثمن قل":
     "إلا لقيتي أخويا نفس هاد الجودة العالية (سوميلة ݣومة، خياطة من الداخل، ومخدومة بلانجيكسيون) وبثمن قل، سير أخويا الله ييسر ليك خوذها من عندهم! حنا سلعتنا نقية، جودتها ممتازة ومضمونة، وفوق هادشي التوصيل فابور وكتشوف السلعة بعينيك عاد تخلص."

🛑 قاعدة صارمة لمنع تضييع التوكن والرسائل الزائدة (1-to-1 Single Message Turn):
   - ممنوع منعاً كلياً تجزيء الرد أو إرسال أكثر من رسالة واحدة لكل رسالة من الزبون!
   - كل رسالة من الزبون = رد واحد فقط جامع ومباشر.
   - لا ترسل أي رسالة من تلقاء نفسك نهائياً، الرد يكون حصراً وقطعاً رداً على الرسالة الواردة من الزبون فقط.
   - إذا سأل الزبون "علاش مكاتجاوبش؟" أو "واش مكاتجاوبش؟": جاوب بلباقة واختصار: "سمح لي أخويا على التعطيلة، راني معاك دابا على الراس والعين! شنو بغيتي تعرف بخصوص الطلبية ديالك؟" بدون اختلاق تبريرات شخصية.
   - لا تكرر الأسئلة ولا تكرر الكلام الذي سبق ذكره في المحادثة. رد باختصار مفيد وبدون حشو باش ما يضيعش التوكن.

🚨 قواعد التركيز الشديد والأولوية القصوى للمقاسات والمعلومات (EXTREME ACCURACY & LATEST SIZE RULES):
1. التركيز المطلق على معلومات الزبون:
   - الاسم الكامل (customer_name)
   - المدينة (city)
   - العنوان الدقيق (الحي والشارع ومعلمة قريبة)
   - رقم الهاتف (phone)
   - 🔴 الأهم على الإطلاق: النمرة (القياس) ديال كل سبرديلة مطلوبة بدقة تامة!

2. قاعدة القياس الأخير هي المعتمدة دائماً (LATEST SIZE IS GOLDEN TRUTH):
   - المقاس المعتمد دائماً وأبداً هو آخر مقاس ذكره الزبون في هذه المحادثة الحالية!
   - 🛑 ممنوع منعاً كلياً وباتاً اعتماد أو تكرار أو فرض أي مقاس قديم اشتراه الزبون في طلبيات سابقة (لأن الزبائن كيرجعو يشريو لناس خرين أو بمقاسات جديدة).
   - إذا كان الزبون مسجلاً في النظام، أكّد معه فقط الاسم والمدينة والعنوان السابق، لكن المقاس خذه دائماً من كلامه الجديد في هذه المحادثة.
   - إذا ذكر الزبون مقاساً في أول المحادثة ثم بدله أو غير رأيه (مثلاً: قال "40" ثم رجع قال "لا دير ليا 42" أو "غير النمرة لـ 43"): المعتمد حصراً وقطعاً هو آخر مقاس طلبه الزبون!
   - افهم سياق المحادثة بذكاء وركز تركيزاً تاماً على آخر قياس لكل سبرديلة.

3. ربط كل سبرديلة بمقاسها بدقة عند طلب أكثر من حذاء (عرض 2 بـ 240 درهم):
   - الكليان يقدر يطلب موديلين مختلفين بمقاسين مختلفين (مثال: COBRA مقاس 40، و New Balance مقاس 43).
   - أو يقدر يطلب نفس الموديل بمقاسين مختلفين (مثال: سبرديلة COBRA مقاس 39 لولدو، وسبرديلة COBRA مقاس 44 لراسو).
   - 🛑 ممنوع نهائياً خلط المقاسات أو إعطاء نفس المقاس للموديلين إلا إذا طلب الزبون نفس المقاس صراحة!
   - اربط كل موديل بمقاسه المطلوب بدقة واضحة ولا تخلط المقاسات نهائياً لكي لا تقع أي مشاكل عند تجهيز الطرود.

4. التعامل الذكي مع الصور والأوديو (Voice Notes & Product Images):
   - إذا أرسل الكليان صورة سبرديلة (مثلاً صورة New Balance أو صورة COBRA):
     • تعرف على الموديل فوراً واربطه به.
     • إذا كتب مع الصورة تعليقاً فيه النمرة (مثلاً 44 أو 43) أو أرسل أوديو فيه النمرة: اربط تلك النمرة بذلك الموديل فوراً.
     • إذا أرسل صورة فقط بدون نمرة، رحب به وأكد له جودة الموديل وسوله على النمرة: "تبارك الله عليك أخويا، هاد الموديل ديال [الاسم] سلعة ممتازة ونقية! شحال النمرة اللي كتلبس؟".

5. تلخيص وتأكيد كل التفاصيل بوضوح قبل/عند تسجيل الطلب (MANDATORY RECAP):
   - عند تأكيد الطلب، لخص للكليان كل شيء بوضوح تام:
     • الموديل الأول: [اسم الموديل] — النمرة: [المقاس] (واللون إن وجد).
     • الموديل الثاني (إن وُجد): [اسم الموديل] — النمرة: [المقاس].
     • الثمن الإجمالي: [150 درهم لـ حبة واحدة، أو 240 درهم لـ حبتين] — التوصيل فابور والدفع عند الاستلام بعد المعاينة.
     • العنوان: [الاسم الكامل] — [المدينة] — [العنوان].

2. خطوات المنهجية الرسمية لتأكيد الطلب والتعامل مع الموديلات والمقاسات:
   🔹 المرحلة 1 (فاش كيسول الكليان فـ الأول على الثمن أو السبرديلات المتوفرة عموماً):
      - عطه الثمن مباشرة: 150 درهم للوحدة، 2 بـ 240 درهم، والتوصيل فابور لجميع المدن والدفع عند الاستلام بعد المعاينة.
      - وسوله مباشرة فـ نفس الرسالة: "أخويا شحال كتلبس؟ (شحال النمرة ديالك؟)".

   🔹 المرحلة 2 (التعامل مع المقاسات والموديلات وعرض الصور لجميع الموديلات):
      - إذا سأل الكليان عن مقاس معين (مثلا: "شنو عندكم فـ 40؟"، "عطيني كاع المنتجات لي كاينين فـ 40"، "أنا كنلبس 43") أو طلب رؤية الموديلات:
        1. ابحث في كتالوج المنتجات أعلاه عن **جميع** الموديلات المتوفرة في ذلك القياس.
        2. اذكر له كل الموديلات المتوفرة في ذلك القياس بأسمائها الواضحة وأثمنتها (150 درهم للحبة، 2 بـ 240 درهم).
        3. 📸 أرسل صورة **كل موديل متوفر** بدون استثناء عبر تاغ [SEND_IMAGE: رابط_الصورة] لكل موديل!
           مثال إذا توفر موديلين:
           [SEND_IMAGE: رابط_صورة_الموديل_الأول]
           [SEND_IMAGE: رابط_صورة_الموديل_الثاني]
        4. اذكر له مواصفات الجودة: (سلعة نقية بزاف وممتازة: سوميلة ݣومة رطبة مريحة ومضادة للانزلاق، خياطة صحيحة من الداخل، ومخدومة بلانجيكسيون).
        5. اسأله: "أينا موديل عجبك فيهم أخويا؟ وأينا لون باغي باش نوجدو ليك الطلبية؟"

   🔹 المرحلة 3 (التعامل الذكي مع العنوان وتأكيد الطلبية):
      ⚡ إذا كان الزبون مسجلاً مسبقاً ولديه عنوان سابق (كما هو مبين في "ملف هذا الزبون في النظام" أعلاه):
         1. 🛑 ممنوع منعاً كلياً أن تسأله عن اسمه ومدينته وعنوانه من الصفر بحال يلا غريب مكاتعرفوش!
         2. استقبله بحرارة كزبون وفيّ باسمه ("مرحبا بك من جديد أخويا ${previousCustomerName || ''}!").
         3. عندما يختار الموديل والمقاس، اعرض عليه عنوانه السابق مباشرة للتأكيد وسوله واش يفضل يغيرو:
            "أخويا ${previousCustomerName || ''}، واش نصيفطو ليك الطلبية لـ نفس العنوان السابق ديالك:
            📍 المدينة: ${previousCity || ''}
            🏠 العنوان: ${previousAddress || ''}
            ولا تحب تغيرو لعنوان آخر؟"
         4. إذا وافق (قال "نعم"، "أه"، "نفس العنوان"، "هو هذاك"، "صيفط لنفس البلاصة"... إلخ):
            - سجل الطلبية فوراً بالمعلومات السابقة باستخدام تاغ:
              [CREATE_ORDER: {"name": "${previousCustomerName || ''}", "city": "${previousCity || ''}", "address": "${previousAddress || ''}", "size": "المقاس_المختار_الجديد", "color": "اللون", "quantity": 1, "product_id": "معرف_الموديل_المختار", "phone": "${phone06}"}]
              أو إذا كان حذائين (عرض 2 بـ 240 درهم):
              [CREATE_ORDER: {"name": "${previousCustomerName || ''}", "city": "${previousCity || ''}", "address": "${previousAddress || ''}", "phone": "${phone06}", "items": [{"product_id": "معرف_الموديل_1", "size": "المقاس_1", "color": "اللون_1", "quantity": 1}, {"product_id": "معرف_الموديل_2", "size": "المقاس_2", "color": "اللون_2", "quantity": 1}]}]
            - وأخبره بتأكيد الطلبية: "صافي على الراس والعين أخويا ${previousCustomerName || ''}، سجلنا ليك الطلبية فـ نفس العنوان! غادي يتواصل معاك الموزع (الليفرور) فـ أقرب وقت باش يجيبها ليك حتى لباب الدار والتوصيل فابور والدفع عند الاستلام بعد المعاينة."
         5. إذا قال "لا بغيت نبدلو" أو ذكر مدينة وعنواناً جديدين:
            - سجل الطلبية بالمدينة والعنوان الجديدين اللذين ذكرهما.

      ⚡ إذا كان الزبون جديداً (أول مرة يتواصل معنا):
         - اطلب منه معلومات التوصيل كالمعتاد:
           • الإسم الكامل:
           • المدينة:
           • العنوان (الحي / الشارع):
           • رقم الهاتف:
         - وعندما يزودك بها، لخصها له وأضف تاغ تسجيل الطلب:
           [CREATE_ORDER: {"name": "اسم_الزبون", "city": "المدينة", "address": "العنوان", "size": "المقاس", "color": "اللون", "quantity": 1, "product_id": "معرف_الموديل_المختار_من_الكتالوج", "phone": "رقم_الهاتف"}]
           أو إذا كان حذائين (عرض 2 بـ 240 درهم):
           [CREATE_ORDER: {"name": "اسم_الزبون", "city": "المدينة", "address": "العنوان", "phone": "رقم_الهاتف", "items": [{"product_id": "معرف_الموديل_1", "size": "المقاس_1", "color": "اللون_1", "quantity": 1}, {"product_id": "معرف_الموديل_2", "size": "المقاس_2", "color": "اللون_2", "quantity": 1}]}]

   🔹 المرحلة 4 (توضيح آجال التوصيل وتواصل فريق التأكيد):
      - وضح مدة التوصيل حسب مدينته:
        • كازا والنواحي ديالها، طنجة، والمدن الكبرى القريبة: 24 ساعة تقريباً.
        • وجدة والمدن البعيدة: كدير تقريباً يومين (48 ساعة).
        • مدن الجنوب (العيون، الداخلة...) والمدن والمراكز الصغرى: من يومين حتى لـ 3 أيام.
        • إذا طلب اليوم والساعة بالضبط: "غادي يتواصل معاك الموزع (الليفرور) فـ أقرب وقت باش يحدد معاك الساعة بالضبط ويوصلها ليك حتى لباب الدار."
      - إذا سألك الكليان: "معاش غادي يتواصل معايا المسؤول / فريق التأكيد؟":
        جاوبه حصراً: "ما بين 2 ديال النهار حتى لـ 5 ديال العشية إن شاء الله."

   🔹 المرحلة 5 (التعامل الذكي مع الشكايات والتبديل والاستفسارات المعقدة - RECLAMATIONS):
      - إذا تواصل الزبون بشكاية، أو مشكل في طلبية سابقة، أو رغبة في استبدال المقاس (ما جاهش المقاس)، أو عيب في السلعة، أو تأخر التوصيل، أو رغبة في التحدث مباشرة مع المسؤول:
        1. استقبله بلباقة تامة واعتذر منه بلطف وهدئ من روعه:
           "على الراس والعين أخويا، ما يكون غير خاطرك وما تقلقش نهائياً، حنا كنتحملو كامل المسؤولية!"
        2. وضح له أن المسؤول سيتصل به هاتفياً لحل المشكل:
           "راني سجلت الشكاية ديالك دابا فـ السيستيم، وغادي يتواصل معاك المسؤول هاتفياً فـ أقرب وقت باش يحل المشكل ديالك ويرتب معاك الأمور إن شاء الله 🙏"
        3. ضع تاغ تسجيل الشكاية في النظام:
           [LOG_RECLAMATION: {"customer_name": "${previousCustomerName || 'زبون'}", "phone": "${phone06}", "type": "exchange", "issue": "تفاصيل المشكل كما ذكره الزبون"}]
           (الأنواع المتاحة: exchange للتبديل، return للاسترجاع، delivery_delay لتأخر التوصيل، product_defect لعيب بالسلعة، cancellation للإلغاء، other لأخرى).`;

            const apiKey = process.env.AI_API_KEY?.trim() || "";
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

            let aiResponse = "";
            try {
              const result = await model.generateContent(prompt);
              aiResponse = result.response.text();
            } catch (genErr) {
              console.error("[WhatsApp Bot] Gemini generateContent failed:", genErr);
              await notifyAdminError({
                context: "توليد رد البوت عبر Gemini (generateContent Failure)",
                error: genErr,
                customerPhone: from,
                incomingMessage: msg_body,
              });
              const fallbackMsg = "سمح لي أخويا، كاين واحد الضغط خفيف فالسيستيم دابا، راني معاك وكنقاد ليك الطلبية ديالك على الراس والعين 🙏";
              await sendWhatsAppMessage(from, fallbackMsg);
              return NextResponse.json({ status: "AI_ERROR_HANDLED" }, { status: 200 });
            }

            console.log(`[WhatsApp Bot] AI Reply to ${from}:\n${aiResponse}`);

            // Check if AI requested logging a customer reclamation
            const recTags = extractJsonObjectsFromTag(aiResponse, "LOG_RECLAMATION");
            for (const recItem of recTags) {
              try {
                const recData = JSON.parse(recItem.jsonStr);
                await logReclamationFromWhatsApp({
                  name: recData.customer_name || previousCustomerName,
                  phone: recData.phone || from,
                  type: recData.type,
                  issue: recData.issue || "شكاية زبون",
                });
                aiResponse = aiResponse.replace(recItem.fullTag, "").trim();
              } catch (recErr) {
                console.error("Error parsing LOG_RECLAMATION JSON:", recErr);
              }
            }

            // Check if AI requested creating an order
            // Supports both single item and multi-item bundles across one or multiple tags
            const orderTags = extractJsonObjectsFromTag(aiResponse, "CREATE_ORDER");
            if (orderTags.length > 0) {
              let combinedItems: CreateOrderItemInput[] = [];
              let baseOrderData: any = null;

              for (const tagItem of orderTags) {
                try {
                  const parsed = JSON.parse(tagItem.jsonStr);
                  if (!baseOrderData) baseOrderData = parsed;
                  if (parsed.items && Array.isArray(parsed.items)) {
                    for (const rawIt of parsed.items) {
                      combinedItems.push({
                        productId: rawIt.productId || rawIt.product_id,
                        size: rawIt.size,
                        color: rawIt.color,
                        quantity: rawIt.quantity || 1,
                      });
                    }
                  } else if (parsed.product_id || parsed.productId || parsed.size) {
                    combinedItems.push({
                      productId: parsed.productId || parsed.product_id,
                      size: parsed.size,
                      color: parsed.color,
                      quantity: parsed.quantity || 1,
                    });
                  }
                } catch (parseErr) {
                  console.error("Error parsing CREATE_ORDER JSON chunk:", parseErr);
                  notifyAdminError({
                    context: "خطأ في قراءة بيانات الطلب (CREATE_ORDER Parse Error)",
                    error: parseErr,
                    customerPhone: from,
                    incomingMessage: tagItem.jsonStr,
                  }).catch(() => {});
                }
              }

              if (baseOrderData) {
                const orderResult = await createOrderFromWhatsApp({
                  name: baseOrderData.name,
                  phone: baseOrderData.phone || from,
                  city: baseOrderData.city,
                  address: baseOrderData.address || baseOrderData.district,
                  items: combinedItems.length > 0 ? combinedItems : undefined,
                  size: baseOrderData.size,
                  color: baseOrderData.color,
                  quantity: baseOrderData.quantity || 1,
                  productId: baseOrderData.product_id || baseOrderData.productId,
                });

                // Remove all [CREATE_ORDER: ...] tags cleanly
                for (const tagItem of orderTags) {
                  aiResponse = aiResponse.replace(tagItem.fullTag, "");
                }
                aiResponse = aiResponse.replace(/\[CREATE_ORDER:\s*\{[\s\S]*?\}\]/g, "").trim();

                if (orderResult && orderResult.orderNumbers.length > 0) {
                  const orderNumsStr = orderResult.orderNumbers.map((n) => `#${n}`).join(" و ");
                  aiResponse += `\n\n📌 رقم الطلبية فـ النظام: ${orderNumsStr} ✅`;

                  // Link primary order to session
                  if (sessionId) {
                    await supabase
                      .from("chat_sessions")
                      .update({ order_id: orderResult.orderId, updated_at: new Date().toISOString() })
                      .eq("id", sessionId);
                  }
                } else {
                  await notifyAdminError({
                    context: "فشل إنشاء الطلب في قاعدة البيانات (createOrder returned null)",
                    error: "createOrderFromWhatsApp returned null",
                    customerPhone: from,
                    incomingMessage: msg_body,
                  });
                }
              }
            }

            // Clean conversational text (strip out [SEND_IMAGE: ...] tags)
            const cleanText = aiResponse.replace(/\[SEND_IMAGE:\s*https?:\/\/[^\s\]]+\]/gi, "").trim();

            // Save assistant response to session history
            if (sessionId) {
              await saveChatMessage(sessionId, "assistant", cleanText);
            }

            // 1. Gather any explicit [SEND_IMAGE: ...] tags from AI response
            const explicitImageUrls = Array.from(
              aiResponse.matchAll(/\[SEND_IMAGE:\s*(https?:\/\/[^\s\]]+)\]/gi)
            ).map((m) => m[1]);

            // 2. Identify all products relevant to this turn (mentioned by name or matching requested size)
            const relevantProducts: typeof products = [];

            // A. Check by product name in AI response
            for (const p of products) {
              const pName = (p.name || "").trim().toLowerCase();
              const cleanPName = pName.replace(/(حذاء|سبرديلة|حداء|رياضي|لارجال|للنساء)/gi, "").trim().toLowerCase();
              const isMentioned =
                (pName.length > 2 && aiResponse.toLowerCase().includes(pName)) ||
                (cleanPName.length > 2 && aiResponse.toLowerCase().includes(cleanPName)) ||
                (pName.includes("cobra") && (aiResponse.toLowerCase().includes("cobra") || aiResponse.includes("كوبرا"))) ||
                (pName.includes("balance") && (aiResponse.toLowerCase().includes("balance") || aiResponse.includes("بالانس")));

              if (isMentioned && !relevantProducts.some((rp) => rp.id === p.id)) {
                relevantProducts.push(p);
              }
            }

            // B. Check if user asked for specific shoe size(s) (e.g. 39, 40, 41, 42, 43, 44, 45)
            const combinedUserQuery = `${msg_body} ${aiResponse}`;
            const sizeMatches = combinedUserQuery.match(/\b(3[8-9]|4[0-6])\b/g);
            if (sizeMatches && sizeMatches.length > 0) {
              for (const reqSize of sizeMatches) {
                for (const p of products) {
                  const stock = p.stock_by_size || {};
                  const stockQty = String(stock[reqSize] ?? "").trim();
                  const hasStock = stockQty !== "" && stockQty !== "0" && stockQty !== "-";
                  const hasInSizes = Array.isArray(p.sizes) && p.sizes.includes(reqSize);
                  if ((hasStock || hasInSizes) && !relevantProducts.some((rp) => rp.id === p.id)) {
                    relevantProducts.push(p);
                  }
                }
              }
            }

            // 3. Assemble images to send (deduplicated)
            const imagesToSend: { url: string; caption: string }[] = [];

            if (relevantProducts.length > 1) {
              // Multiple models: send photo for each model with its name & price
              for (const p of relevantProducts) {
                const img = p.image_urls?.[0];
                if (img && !imagesToSend.some((item) => item.url === img)) {
                  imagesToSend.push({
                    url: img,
                    caption: `👟 ${p.name} — ${p.price_mad} درهم`,
                  });
                }
              }
            } else if (relevantProducts.length === 1) {
              const p = relevantProducts[0];
              const img = p.image_urls?.[0];
              if (img && !imagesToSend.some((item) => item.url === img)) {
                imagesToSend.push({
                  url: img,
                  caption: `👟 ${p.name}`,
                });
              }
            }

            // Include any additional explicit tags from AI
            for (const url of explicitImageUrls) {
              if (!imagesToSend.some((item) => item.url === url)) {
                const matchingP = products.find((p) => p.image_urls?.includes(url));
                imagesToSend.push({
                  url,
                  caption: matchingP ? `👟 ${matchingP.name}` : "",
                });
              }
            }

            console.log(`[WhatsApp Bot] Delivering to ${from}: ${imagesToSend.length} product images`);

            if (imagesToSend.length === 1) {
              // Single image: send as 1 unified message with full text caption
              const singleCaption = cleanText.length > 1000 ? cleanText.slice(0, 997) + "..." : cleanText;
              await sendWhatsAppImage(from, imagesToSend[0].url, singleCaption);
            } else if (imagesToSend.length > 1) {
              // Multiple images: send all product photos FIRST
              for (const item of imagesToSend) {
                await sendWhatsAppImage(from, item.url, item.caption);
                // 250ms spacing between photos
                await new Promise((r) => setTimeout(r, 250));
              }
              // 400ms delay to ensure WhatsApp queues media packets first before text
              await new Promise((r) => setTimeout(r, 400));

              // Then send the conversational and informational message right underneath the photos
              if (cleanText) {
                await sendWhatsAppMessage(from, cleanText);
              }
            } else {
              // No images to send: send text message
              await sendWhatsAppMessage(from, cleanText || aiResponse);
            }
          } catch (aiError) {
            console.error("AI Generation Error:", aiError);
            await notifyAdminError({
              context: "معالجة رسالة المحادثة (Conversation Turn Error)",
              error: aiError,
              customerPhone: from,
              incomingMessage: msg_body,
            });
            if (isVoiceNote) {
              await sendWhatsAppMessage(
                from,
                "سمح لي أخويا، الصوت ما واضحش مزيان فـ هاد الأوديو (مخرشش شوية)، عفاك عاود صيفط ليا أوديو واضح ولا كتب ليا فـ ميساج باش نجاوبك مزيان 🙏"
              );
            } else {
              await sendWhatsAppMessage(
                from,
                "مرحبا بك! شكرا على تواصلك معنا، غادي يجاوبك أحد ممثلي الخدمة فـ أقرب وقت."
              );
            }
          }
        }
      } finally {
        activeProcessingPhones.delete(from);
      }
    }

    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } else {
    return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
  }
} catch (error) {
  console.error("Webhook error:", error);
  await notifyAdminError({
    context: "خطأ عام في الويب هوك (WhatsApp Webhook Global Error)",
    error: error,
  });
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
}



