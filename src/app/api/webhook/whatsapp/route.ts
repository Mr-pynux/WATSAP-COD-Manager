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

    // 2. Download media bytes
    const mediaRes = await fetch(metaData.url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "curl/7.64.1",
      },
    });

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
  size,
  color,
  quantity,
  productId,
}: {
  name: string;
  phone: string;
  city: string;
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
        product_id: product.id,
        size: size || "42",
        color: color || null,
        quantity: qty,
        unit_price_mad: unitPrice,
        payment_method: "cod",
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        notes: "تم الطلب والتأكيد عبر واتساب بوت (AI)",
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
        const isAudio = message.type === "audio" || message.type === "voice" || !!message.audio;
        let isVoiceNote = false;

        console.log(`[WhatsApp Webhook] Received message from ${from}: ${msg_body || `[${message.type || "unknown"} message]`}`);

        // Mark as read
        if (messageId) {
          markMessageAsRead(messageId).catch(() => {});
        }

        if (isAudio) {
          const mediaId = message.audio?.id;
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
            console.log(`[WhatsApp Bot] Audio download/transcription failed. Sending fallback baffle reply.`);
            const fallback = "خويا راني خاسر ليا الباف، عفاك كتب ليا فالميساج ديالك 🙏";
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

            // Format product catalog for AI prompt
            const catalogText = products
              .map((p) => {
                const colorsList = Array.isArray(p.colors)
                  ? p.colors.map((c: any) => (typeof c === "object" ? c.name : c)).join(", ")
                  : "";
                const sizesList = Array.isArray(p.sizes) ? p.sizes.join(", ") : "";
                const offer = p.offer_qty && p.offer_total_mad
                  ? `عرض خاص: ${p.offer_qty} بـ ${p.offer_total_mad} درهم`
                  : "";
                const img = p.image_urls?.[0] || "";

                return `• اسم المنتج: ${p.name} (ID: ${p.id})
  الثمن: ${p.price_mad} درهم ${p.old_price_mad ? `(الثمن قبل التخفيض: ${p.old_price_mad} درهم)` : ""}
  ${offer ? `  ${offer}` : ""}
  المقاسات: ${sizesList}
  الألوان: ${colorsList}
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
كتالوج المنتجات المتوفرة حالياً في المتجر:
${catalogText}
---

سجل المحادثة السابقة مع هذا الزبون (رقم هاتفه: ${from}):
${historyText}
---

${userPromptText}

قواعد صارمة جداً لإدارة الرد والبيع الذكي:
0. الهوية البشرية ومنع ذكر الروبوت نهائياً:
   ممنوع منعاً باتاً ومطلقاً أن تقول أو تلمح أنك ذكاء اصطناعي، أو بوت، أو روبوت، أو مساعد آلي! الكليان كيهضر مع إنسان حقيقي وتاجر مغربي من متجر Shoespot ("أنا معاك فالمحل أخويا"). جاوب مباشرة بأسلوب ودود ومحترم وبدون أي كلام آلي.
1. الأسعار الثابتة وممنوع نهائياً التفاوض أو إنقاص الثمن:
   • حذاء واحد (1): 150 درهم فقط.
   • عرض خاص لحذائين (2): 240 درهم فقط (120 درهم للحذاء، توفير 60 درهم).
   • التوصيل: فابور (مجاني 100%) لجميع مدن المغرب حتى لباب الدار والدفع عند الاستلام بعد معاينة السلعة وتفقدها.
   • ممنوع التفاوض نهائياً: إذا حاول الزبون المساومة أو طلب تخفيض ("نقص ليا"، "دير معايا 120 ولا 100 درهم")، ارفض بأدب واحترام واشرح له أن السعر ثابت ومناسب جداً لأن التوصيل مجاني والسلعة ممتازة ومضمونة، واقترح عليه عرض الحبتين (2 بـ 240 درهم).
2. المميزات التقنية لسبرديلة COBRA (إقناع الكليان بالسلعة):
   اشرح مميزات السبرديلة إذا سأل عنها أو عند الحديث عن الجودة:
   - سوميلة ݣومة أصلية (Semelle en Gomme): مريحة، رطبة، كتمتص الصدمات وما كتزلقش.
   - خياطة صحيحة من الداخل (Cousue de l'intérieur): متينة وكتصبر بزاف ومكتتفكش مع الاستعمال.
   - مخدومة بتقنية لالجيكسيون (Injection): لاصقة بماكينات حرارية صناعية عالية الجودة وماشي غير كولا عادية.
3. أسلوب البيع الذكي (الجاذبية بدون إلحاح):
   - اشرح المميزات برزانة وجاذبية، ولكن إياك والإلحاح! ما تبقاش ملصق فالكليان. إذا حس الكليان بيك باغي تبيع ليه بزز راه غادي يشك ويهرب. خليك واثق من راسك ومن سلعتك.
4. الرد على اعتراض "لقيتها فـ بلاصة خرى بثمن قل" (القاعدة الذهبية):
   إذا قال الزبون: "لقيتها فـ بلاصة أخرى رخص" أو "كاينا بـ 100 درهم فالزنقة":
   رد عليه بثقة وهدوء واحترام:
   "إلا لقيتي أخويا نفس هاد الجودة العالية (سوميلة ݣومة، خياطة من الداخل، ومخدومة بلانجيكسيون) وبثمن قل، سير أخويا الله ييسر ليك خوذها من عندهم! حنا سلعتنا نقية وأوريجينال وضامنين الجودة ديالها، وفوق هادشي التوصيل فابور وكتشوف السلعة بعينيك عاد تخلص."
5. إرسال الصور فوراً عند طلبها:
   إذا طلب الزبون صوراً أو رؤية المنتج أو الألوان ("صيفط ليا التصاور"، "وريني"، "شوف"، "التصاور"):
   يجب إضافة هذا التاغ في ردك:
   [SEND_IMAGE: رابط_الصورة]
   مثال: "تفضل أخويا هاهي صورة سبرديلة COBRA باللون الأسود الأنيق 👇 [SEND_IMAGE: ${products[0]?.image_urls?.[0] || ""}]"
6. ذاكرة المحادثة ومنع تكرار الأسئلة:
   انتبه جيداً للرسائل السابقة. إذا قدم الزبون المقاس أو المدينة أو الاسم مسبقاً، لا تسأله عنها ثانية أبداً!
7. اكتمال الطلب والتسجيل الفوري:
   بمجرد أن تتوفر لديك المعلومات الأساسية (الاسم، المدينة، المقاس)، أو إذا أكد رغبته في الشراء:
   - اشكره بلباقة وأكد له أن الطلب تم تسجيله وسيتصل به الموزع للتوصيل (الدفع عند الاستلام والتوصيل مجاني).
   - قم فوراً بإضافة هذا التاغ في آخر ردك، جامعاً كل المعلومات من كامل المحادثة:
   [CREATE_ORDER: {"name": "اسم_الزبون", "city": "المدينة", "size": "المقاس", "color": "اللون", "quantity": 1, "product_id": "معرف_المنتج", "phone": "رقم_الهاتف"}]`;

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

            // Save assistant response to session history
            if (sessionId) {
              const cleanHistoryContent = aiResponse.replace(/\[SEND_IMAGE:\s*https?:\/\/[^\s\]]+\]/gi, "").trim();
              await saveChatMessage(sessionId, "assistant", cleanHistoryContent);
            }

            // Check if AI requested sending an image
            const imageMatch = aiResponse.match(/\[SEND_IMAGE:\s*(https?:\/\/[^\s\]]+)\]/i);

            if (imageMatch && imageMatch[1]) {
              const imageUrl = imageMatch[1];
              // Remove the [SEND_IMAGE: ...] tag from the text message to keep clean caption
              const cleanCaption = aiResponse.replace(/\[SEND_IMAGE:\s*https?:\/\/[^\s\]]+\]/gi, "").trim();

              console.log(`[WhatsApp Bot] Sending Image to ${from}: ${imageUrl}`);

              if (cleanCaption.length > 900) {
                await sendWhatsAppImage(from, imageUrl, "تفضل أخويا صورة المنتج 👇");
                await sendWhatsAppMessage(from, cleanCaption);
              } else {
                await sendWhatsAppImage(from, imageUrl, cleanCaption);
              }
            } else {
              // Send standard text message
              await sendWhatsAppMessage(from, aiResponse);
            }
          } catch (aiError) {
            console.error("AI Generation Error:", aiError);
            if (isVoiceNote) {
              await sendWhatsAppMessage(
                from,
                "خويا راني خاسر ليا الباف، عفاك كتب ليا فالميساج ديالك 🙏"
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



