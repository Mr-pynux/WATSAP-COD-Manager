import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

if (fs.existsSync(".env.local")) {
  fs.readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
    const idx = line.indexOf("=");
    if (idx !== -1 && !line.trim().startsWith("#")) {
      process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
    }
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const apiKey = process.env.AI_API_KEY?.trim();

async function simulateAdminQuery(userMsg) {
  console.log("\n==========================================");
  console.log("Testing Admin Query:", userMsg);
  console.log("==========================================");

  const [ordersRes, reclamationsRes, productsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, customer_name, phone, city, status, unit_price_mad, quantity, items, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("reclamations")
      .select("id, customer_name, phone, type, issue, status")
      .limit(5),
    supabase
      .from("products")
      .select("id, name, price_mad, stock_by_size")
      .eq("active", true),
  ]);

  const orders = ordersRes.data || [];
  const recs = reclamationsRes.data || [];
  const prods = productsRes.data || [];

  const ordersText = orders.map((o) => `• الطلبية #${o.order_number} | الزبون: ${o.customer_name} | ${o.phone} | ${o.city} | الحالة: [${o.status}] | الثمن: ${o.unit_price_mad * o.quantity} درهم`).join("\n");
  const recsText = recs.length > 0 ? recs.map((r) => `• شكاية (${r.type}): ${r.customer_name} | الحالة: [${r.status}] | المشكل: ${r.issue}`).join("\n") : "لا توجد أي شكايات مسجلة حالياً.";
  const prodsText = prods.map((p) => `• ${p.name} | الثمن: ${p.price_mad} درهم | المخزون: ${JSON.stringify(p.stock_by_size || {})}`).join("\n");

  const prompt = `أنت "المساعد التنفيذي والإداري والتقني الذكي" لمتجر Shoespot، وتتحدث مباشرة وفقط مع صاحب المتجر والمدير العام: "سي أيوب" (الأدمين / الشاف) عبر الواتساب.

🚨 قواعد صارمة ومقدسة في وضع الأدمين (EXECUTIVE ADMIN MODE):
1. أنت لست في وضع بيع زبائن!
   - 🛑 ممنوع منعاً كلياً وباتاً أن تعامل سي أيوب كزبون عادي!
   - 🛑 ممنوع تسأله عن النمرة (المقاس) ديالو، وممنوع تقترح عليه يشري سبرديلة، وممنوع تسأله عن العنوان أو المدينة ديال التوصيل!
   - 🛑 ممنوع نهائياً استخدام تاغات الزبائن مثل [CREATE_ORDER] أو إرسال صور السلع للبيع.

2. أسلوب التخاطب:
   - تحدث بالدارجة المغربية الإدارية والعملية والمحترمة (Business Darija).
   - ناديه بتقدير: "سي أيوب"، "أ شاف"، "خويا أيوب".
   - كن سريع البديهة، دقيقاً في الأرقام، ملخصاً ومباشراً بدون إطالة فارغة.

المعطيات الحية:
قائمة آخر الطلبيات:
${ordersText}

الشكايات:
${recsText}

المنتجات والسطوك:
${prodsText}

الرسالة من سي أيوب: "${userMsg}"

أجب بالدارجة المغربية بأسلوب تنفيذي لسي أيوب.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });
  const result = await model.generateContent(prompt);
  console.log("AI Response:\n", result.response.text());
}

async function main() {
  await simulateAdminQuery("سلام، شنو كاين فـ الطلبيات اليوم؟ واش كاين شي عطب ولا ريكلاماسيون؟");
  await simulateAdminQuery("شوف ليا الكوموند ديال يوسف عبد ربه، وبدل الحالة ديالها لـ shipped");
}

main();
