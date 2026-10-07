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

// Basic function to mark message as read
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

// Helper to create an order in Supabase directly from WhatsApp
async function createOrderFromWhatsApp({
  name,
  phone,
  city,
  address,
  size,
  color,
  quantity,
  productId,
}: {
  name: string;
  phone: string;
  city: string;
  address?: string;
  size: string;
  color?: string;
  quantity?: number;
  productId?: string;
}) {
  try {
    // 1. Fetch active product
    let query = supabase.from("products").select("id, price_mad, offer_qty, offer_total_mad");
    if (productId) {
      query = query.eq("id", productId);
    } else {
      query = query.eq("active", true).limit(1);
    }
    const { data: products } = await query;
    const product = products?.[0];

    if (!product) {
      console.error("No product found to create order");
      return null;
    }

    const qty = quantity || 1;
    let unitPrice = Number(product.price_mad);
    if (product.offer_qty && product.offer_total_mad && qty >= product.offer_qty) {
      unitPrice = Number(product.offer_total_mad) / product.offer_qty;
    }

    // Clean phone number (format as 06... or 07...)
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("212") && cleanPhone.length === 12) {
      cleanPhone = "0" + cleanPhone.slice(3);
    }

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_name: name || "زبون واتساب",
        phone: cleanPhone,
        city: city || "المغرب",
        district: address || null,
        product_id: product.id,
        size: size || "42",
        color: color || null,
        quantity: qty,
        unit_price_mad: unitPrice,
        payment_method: "cod",
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        notes: address ? `العنوان: ${address} (تأكيد واتساب بوت)` : "تم الطلب والتأكيد عبر واتساب بوت (AI)",
      })
      .select("id, order_number")
      .single();

    if (error || !order) {
      console.error("Error creating order from WhatsApp:", error);
      return null;
    }

    // Insert order event
    await supabase.from("order_events").insert({
      order_id: order.id,
      type: "created",
      detail: { source: "whatsapp_bot", channel: "meta_cloud_api" },
    });

    console.log(`[Order Created] Order #${order.order_number} successfully registered from WhatsApp for ${name} (${cleanPhone})!`);
    return { orderNumber: order.order_number, orderId: order.id };
  } catch (err) {
    console.error("Exception creating order:", err);
    return null;
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
        let isVoiceNote = false;

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
        }

        if (msg_body) {
          try {
            // 1. Get or create chat session for this customer
            const sessionId = await getOrCreateSession(from);

            // 2. Fetch conversation history
            const history = sessionId ? await getChatHistory(sessionId, 8) : [];

            // 3. Save incoming user message
            const userHistoryMsg = isVoiceNote ? `🎙️ [أوديو]: "${msg_body}"` : msg_body;
            if (sessionId) {
              await saveChatMessage(sessionId, "user", userHistoryMsg);
            }

            // 4. Fetch live bot settings and products from Supabase
            const [botSettingsRes, productsRes] = await Promise.all([
              supabase.from("bot_settings").select("*").limit(1).single(),
              supabase.from("products").select("*").eq("active", true),
            ]);

            const botSettings = botSettingsRes.data;
            const products = productsRes.data || [];

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
   - لا تكرر الأسئلة ولا تكرر الكلام الذي سبق ذكره في المحادثة. رد باختصار مفيد وبدون حشو باش ما يضيعش التوكن.

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
        6. إذا كان قد اختار موديلاً محدداً وذكر قياسه، اطلب منه معلومات التوصيل مباشرة:
           - الإسم الكامل:
           - المدينة:
           - العنوان:
           - رقم الهاتف:

   🔹 المرحلة 3 (ملي يعطيك الكليان هاد المعلومات: الاسم، المدينة، العنوان، الهاتف، ونوع الموديل):
      - رجع له معلوماته ملخصة باش يتأكد منها:
        "الله يحفظك أخويا، ها هما المعلومات ديالك باش نتأكدو:
        • الموديل: {اسم_الموديل_المختار}
        • الإسم: {name}
        • المدينة: {city}
        • العنوان: {address}
        • رقم الهاتف: {phone}
        • القياس: {size}
        • الثمن الإجمالي: {total} درهم (التوصيل فابور والدفع عند الاستلام بعد المعاينة)
        راه غادي يتواصل معاك المسؤول على التأكيد هاد العشية ما بين 2 و 5 إن شاء الله فـ هاد النمرة باش يأكد معاك."
      - وأضف تاغ تسجيل الطلب في نهاية الرد مستخدماً المعرف الحقيقي للموديل الذي اختاره:
        [CREATE_ORDER: {"name": "اسم_الزبون", "city": "المدينة", "address": "العنوان", "size": "المقاس", "color": "اللون", "quantity": 1, "product_id": "معرف_الموديل_المختار_من_الكتالوج", "phone": "رقم_الهاتف"}]

   🔹 المرحلة 4 (توضيح آجال التوصيل وتواصل فريق التأكيد):
      - وضح مدة التوصيل حسب مدينته:
        • كازا والنواحي ديالها، طنجة، والمدن الكبرى القريبة: 24 ساعة تقريباً.
        • وجدة والمدن البعيدة: كدير تقريباً يومين (48 ساعة).
        • مدن الجنوب (العيون، الداخلة...) والمدن والمراكز الصغرى: من يومين حتى لـ 3 أيام.
        • إذا طلب اليوم والساعة بالضبط: "غادي يتواصل معاك الموزع (الليفرور) فـ أقرب وقت باش يحدد معاك الساعة بالضبط ويوصلها ليك حتى لباب الدار."
      - إذا سألك الكليان: "معاش غادي يتواصل معايا المسؤول / فريق التأكيد؟":
        جاوبه حصراً: "ما بين 2 ديال النهار حتى لـ 5 ديال العشية إن شاء الله."`;

            const apiKey = process.env.AI_API_KEY?.trim() || "";
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

            const result = await model.generateContent(prompt);
            let aiResponse = result.response.text();

            console.log(`[WhatsApp Bot] AI Reply to ${from}:\n${aiResponse}`);

            // Check if AI requested creating an order
            const orderMatch = aiResponse.match(/\[CREATE_ORDER:\s*(\{.*?\})\]/s);
            if (orderMatch && orderMatch[1]) {
              try {
                const orderData = JSON.parse(orderMatch[1]);
                const orderResult = await createOrderFromWhatsApp({
                  name: orderData.name,
                  phone: orderData.phone || from,
                  city: orderData.city,
                  address: orderData.address || orderData.district,
                  size: orderData.size,
                  color: orderData.color,
                  quantity: orderData.quantity || 1,
                  productId: orderData.product_id,
                });

                // Remove the tag from user message and include order number confirmation
                aiResponse = aiResponse.replace(/\[CREATE_ORDER:\s*\{.*?\}\]/s, "").trim();
                if (orderResult) {
                  aiResponse += `\n\n📌 رقم الطلبية ديالك فـ النظام: #${orderResult.orderNumber} ✅`;

                  // Link order to session
                  if (sessionId) {
                    await supabase
                      .from("chat_sessions")
                      .update({ order_id: orderResult.orderId, updated_at: new Date().toISOString() })
                      .eq("id", sessionId);
                  }
                }
              } catch (parseErr) {
                console.error("Error parsing CREATE_ORDER JSON:", parseErr);
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

            // B. Check if user asked for a specific shoe size (e.g. 39, 40, 41, 42, 43, 44, 45)
            const combinedUserQuery = `${msg_body} ${aiResponse}`;
            const sizeMatches = combinedUserQuery.match(/\b(3[8-9]|4[0-6])\b/g);
            if (sizeMatches && sizeMatches.length > 0) {
              const reqSize = sizeMatches[0];
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
              // Multiple images: send all product photos with clear badges
              for (const item of imagesToSend) {
                await sendWhatsAppImage(from, item.url, item.caption);
              }
              // Send the complete conversational message
              if (cleanText) {
                await sendWhatsAppMessage(from, cleanText);
              }
            } else {
              // No images to send: send text message
              await sendWhatsAppMessage(from, cleanText || aiResponse);
            }
          } catch (aiError) {
            console.error("AI Generation Error:", aiError);
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
      }

      return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
    } else {
      return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}



