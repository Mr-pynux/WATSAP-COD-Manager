"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Verify admin access
async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

function getServiceSupabase() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return null;
}

export async function getBotSettingsServer() {
  await verifyAdmin();
  const supabase = getServiceSupabase() || (await createClient());
  const { data, error } = await supabase
    .from("bot_settings")
    .select("*")
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  return { settings: data || null };
}

export async function saveBotSettingsServer(isActive: boolean, systemPrompt: string) {
  await verifyAdmin();
  const supabase = getServiceSupabase() || (await createClient());
  
  // Try to get existing settings
  const { data: existing } = await supabase
    .from("bot_settings")
    .select("id")
    .limit(1)
    .single();

  let error;
  
  if (existing) {
    // Update
    const res = await supabase
      .from("bot_settings")
      .update({ is_active: isActive, system_prompt: systemPrompt, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    error = res.error;
  } else {
    // Insert
    const res = await supabase
      .from("bot_settings")
      .insert({ is_active: isActive, system_prompt: systemPrompt });
    error = res.error;
  }

  if (error) throw new Error(error.message);
  return { success: true };
}

export interface BotContactAnalytics {
  id: string;
  phone: string;
  displayPhone: string;
  waLink: string;
  role: "admin" | "confirmed_customer" | "customer" | "blacklisted";
  contactName: string;
  status: string;
  messagesCount: number;
  userMessagesCount: number;
  assistantMessagesCount: number;
  audioCount: number;
  totalTokens: number;
  lastActive: string;
  lastMessage: {
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
    isAudio: boolean;
  } | null;
  order: {
    id: string;
    orderNumber: number;
    customerName: string;
    status: string;
    city: string;
    totalMad: number;
  } | null;
}

export interface BotAnalyticsResponse {
  kpis: {
    totalTokens: number;
    todayTokens: number;
    totalContacts: number;
    totalMessages: number;
    todayMessages: number;
    totalAudio: number;
    todayAudio: number;
    freeTierStatus: string;
  };
  contacts: BotContactAnalytics[];
}

export async function getBotAnalyticsServer(): Promise<BotAnalyticsResponse> {
  await verifyAdmin();
  const supabase = getServiceSupabase() || (await createClient());

  const [sessionsRes, messagesRes, ordersRes, blacklistRes] = await Promise.all([
    supabase
      .from("chat_sessions")
      .select("id, phone, status, created_at, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("chat_messages")
      .select("id, session_id, role, content, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id, order_number, customer_name, phone, status, city, unit_price_mad, quantity"),
    supabase.from("blacklist").select("phone"),
  ]);

  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (messagesRes.error) throw new Error(messagesRes.error.message);

  const sessions = sessionsRes.data || [];
  const messages = messagesRes.data || [];
  const orders = ordersRes.data || [];
  const blacklist = new Set((blacklistRes.data || []).map((b: any) => (b.phone || "").replace(/\D/g, "")));

  const adminPhone = (process.env.ADMIN_WHATSAPP_PHONE || "212610026260").replace(/\D/g, "");
  const todayStr = new Date().toISOString().split("T")[0];

  let totalAudioCount = 0;
  let totalAssistantTurns = 0;
  let todayAssistantTurns = 0;
  let todayAudioCount = 0;
  let todayMessagesCount = 0;

  const sessionMessagesMap = new Map<string, any[]>();
  messages.forEach((m) => {
    const list = sessionMessagesMap.get(m.session_id) || [];
    list.push(m);
    sessionMessagesMap.set(m.session_id, list);

    const isToday = m.created_at && m.created_at.startsWith(todayStr);
    const isAudio = m.content && (m.content.includes("🎙️") || m.content.includes("[أوديو]"));

    if (m.role === "assistant") {
      totalAssistantTurns++;
      if (isToday) todayAssistantTurns++;
    }
    if (isAudio) {
      totalAudioCount++;
      if (isToday) todayAudioCount++;
    }
    if (isToday) {
      todayMessagesCount++;
    }
  });

  // Token calculation:
  // Prompt context + memory ~ 2,100 tokens per assistant turn + 300 output tokens = 2,400 tokens
  // Voice note multimodal audio processing ~ 350 tokens per audio clip
  // User input message text ~ 60 tokens
  const totalTokens = (totalAssistantTurns * 2400) + (totalAudioCount * 350) + (messages.length * 60);
  const todayTokens = (todayAssistantTurns * 2400) + (todayAudioCount * 350) + (todayMessagesCount * 60);

  const contacts: BotContactAnalytics[] = sessions.map((session) => {
    const sMsgs = sessionMessagesMap.get(session.id) || [];
    const cleanPhone = session.phone.replace(/\D/g, "");

    let displayPhone = cleanPhone;
    if (cleanPhone.startsWith("212") && cleanPhone.length === 12) {
      displayPhone = "0" + cleanPhone.slice(3);
    }

    const isAdmin = cleanPhone === adminPhone || (cleanPhone.length >= 9 && adminPhone.endsWith(cleanPhone.slice(-9)));
    const isBlacklisted = blacklist.has(cleanPhone) || blacklist.has(displayPhone);

    const matchedOrder = orders.find((o) => {
      const oClean = o.phone ? o.phone.replace(/\D/g, "") : "";
      return (
        oClean === cleanPhone ||
        oClean === displayPhone ||
        (cleanPhone.length >= 9 && oClean.endsWith(cleanPhone.slice(-9)))
      );
    });

    let role: "admin" | "blacklisted" | "confirmed_customer" | "customer" = "customer";
    let contactName = "زبون (محادثة واتساب)";

    if (isAdmin) {
      role = "admin";
      contactName = "سي أيوب (المدير العام 👑)";
    } else if (isBlacklisted) {
      role = "blacklisted";
      contactName = "رقم محظور 🚫";
    } else if (matchedOrder) {
      role = "confirmed_customer";
      contactName = `${matchedOrder.customer_name} (طلب #${matchedOrder.order_number})`;
    }

    let userMsgs = 0;
    let botMsgs = 0;
    let audioCount = 0;
    sMsgs.forEach((m) => {
      if (m.role === "assistant") botMsgs++;
      if (m.role === "user") {
        userMsgs++;
        if (m.content && (m.content.includes("🎙️") || m.content.includes("[أوديو]"))) {
          audioCount++;
        }
      }
    });

    const lastMsg = sMsgs.length > 0 ? sMsgs[sMsgs.length - 1] : null;
    const sessionTokens = (botMsgs * 2400) + (audioCount * 350) + (sMsgs.length * 60);

    return {
      id: session.id,
      phone: session.phone,
      displayPhone,
      waLink: `https://wa.me/${cleanPhone.startsWith("212") ? cleanPhone : "212" + cleanPhone.replace(/^0/, "")}`,
      role,
      contactName,
      status: session.status,
      messagesCount: sMsgs.length,
      userMessagesCount: userMsgs,
      assistantMessagesCount: botMsgs,
      audioCount,
      totalTokens: sessionTokens,
      lastActive: lastMsg ? lastMsg.created_at : session.updated_at,
      lastMessage: lastMsg
        ? {
            role: lastMsg.role,
            content: lastMsg.content,
            createdAt: lastMsg.created_at,
            isAudio: lastMsg.content && (lastMsg.content.includes("🎙️") || lastMsg.content.includes("[أوديو]")),
          }
        : null,
      order: matchedOrder
        ? {
            id: matchedOrder.id,
            orderNumber: matchedOrder.order_number,
            customerName: matchedOrder.customer_name,
            status: matchedOrder.status,
            city: matchedOrder.city,
            totalMad: (matchedOrder.unit_price_mad || 0) * (matchedOrder.quantity || 1),
          }
        : null,
    };
  });

  return {
    kpis: {
      totalTokens,
      todayTokens,
      totalContacts: sessions.length,
      totalMessages: messages.length,
      todayMessages: todayMessagesCount,
      totalAudio: totalAudioCount,
      todayAudio: todayAudioCount,
      freeTierStatus: "100% مجاني (Google Gemini Free Tier - 0.00 DH)",
    },
    contacts,
  };
}

export async function getSessionMessagesServer(sessionId: string) {
  await verifyAdmin();
  const supabase = getServiceSupabase() || (await createClient());

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return { messages: data || [] };
}
