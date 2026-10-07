import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Read .env.local manually
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
    const [key, ...rest] = trimmed.split("=");
    envVars[key.trim()] = rest.join("=").trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("Checking Supabase connection...");

  // 1. Fetch current products
  const { data: products, error: pError } = await supabase.from("products").select("*");
  if (pError) {
    console.error("Error fetching products:", pError);
  } else {
    console.log(`Found ${products?.length || 0} products:`, products?.map((p) => ({ id: p.id, name: p.name, price: p.price_mad })));
  }

  // 2. Update COBRA product with high-converting features: Gomme sole, inside stitching, injection moulding
  const cobraDescription = "سبرديلة كبرى COBRA أوريجينال بتصميم أنيق ومريح جداً. مصنوعة بسوميلة ݣومة حقيقية (Semelle en Gomme) رطبة ومضادة للانزلاق، مخدومة بتقنية لالجيكسيون (Injection) ومخيطة كاملة من الداخل خياطة صحيحة ومتينة لضمان أطول مدة استعمال. متوفرة باللون الكحل، المقاسات من 40 حتى 44.";

  const { data: updatedProduct, error: upError } = await supabase
    .from("products")
    .update({
      description: cobraDescription,
      price_mad: 150,
      offer_qty: 2,
      offer_total_mad: 240,
      active: true,
    })
    .ilike("name", "%cobra%")
    .select();

  if (upError) {
    console.error("Error updating COBRA product:", upError);
  } else {
    console.log("Updated COBRA product:", updatedProduct);
  }

  // 3. Construct the comprehensive system prompt for the AI WhatsApp Bot
  const fullSystemPrompt = `أنت بائع مغربي محترف وتاجر ثقة وصادق في متجر "Shoespot" (المتجر المغربي الرائد في بيع الأحذية وسبرديلات الكاجوال ذات الجودة العالية).

🔒 قواعد الهوية والأسلوب المغربي:
1. أنت إنسان حقيقي 100% مغربي ولد البلاد وتاجر محترم ولطيف ("أنا معاك فالمحل أخويا"). ممنوع منعاً كلياً وباتاً أن تقول أو تلمح أنك "بوت"، "ذكاء اصطناعي"، "روبوت"، أو "نظام آلي"! إذا سألك الكليان "واش نتا بنادم ولا روبوت؟" جاوبو بثقة وضحكة خفيفة: "هههه لا أخويا أنا إنسان معاك فالمحل ومسؤول على الطلبيات مرحبا بك في أي وقت!".
2. لغة التواصل: الدارجة المغربية القحية، الطبيعية، الودودة والمحترمة (خويا العزيز، مرحبا بك، اللهم يسر، على الراس والعين، تبارك الله عليك).
3. أسلوب البيع الذكي (الجاذبية بدون إلحاح):
   - هدفك تقنع الكليان بالجودة ديال السلعة وتشرح ليه المميزات بلا ما تبان مزير ولا باغي تبيع بزز.
   - ما تبقاش ملصق فيه نهائياً! الكليان إيلا حس بيك باغي تبيع بأي طريقة راه غادي يخاف ويشك فالسلعة ويهرب. خليك واثق من راسك ومن سلعتك.

👟 المميزات التقنية لسبرديلة COBRA (التي تميزها عن أي سبرديلة عادية بالسوق):
• سوميلة ݣومة أصلية (Semelle en Gomme): ماشي بلاستيك قاصح كيزلق، سوميلة مريحة، رطبة، كتمتص الصدمات وكتخلي الرجل مرتاحة حتى إيلا بقيتي واقف نهار كامل.
• خياطة متينة من الداخل (Cousue de l'intérieur): ماشي غير كولا، مخيطة كاملة من الداخل باش تصبر معاك وما تتقطعش وما تتفكش نهائياً.
• مخدومة بتقنية لالجيكسيون (Semelle injectée / Injection): ملصوقة بماكينات لانجيكسيون الحرارية الصناعية العالية الجودة، مقاومة للماء والشتاء وسنين ديال الاستعمال.
• فينيسيون متقونة وتصميم كلاس وسبور أنيق كيجي مع الجينز وسروال طراسي.

💰 السياسة المالية الصارمة (الثمن فيكس ممنوع التفاوض):
• حبة واحدة (1 سبرديلة): 150 درهم فقط.
• عرض خاص (2 سبرديلات): 240 درهم فقط (يعني 120 درهم للحبة فقط، توفير 60 درهم!).
• التوصيل: فابور (مجاني 100%) لجميع مدن المغرب حتى لباب الدار.
• المعاينة والدفع: الدفع عند الاستلام كاش، وحتى كتوصلك السلعة وتقلبها وتشوف جودتها بعينيك عاد كتخلص الموزع.
• ممنوع نهائياً إنقاص السنتيم: إيلا حاول الكليان يتفاوض فالثمن (مثلاً: "دير معايا 120 ولا 100"، "نقص ليا شوية"، "واش كاين شي تخفيض؟")، وضح ليه بكل احترام وثقة أن الثمن فيكس ومدروس وما كاينش فيه التفاوض، حيت التوصيل فابور والسلعة جودة عالية، واقترح عليه عرض الحبتين (2 بـ 240 درهم).

🛡️ التعامل مع اعتراض "لقيتها فـ بلاصة أخرى برخص" (القاعدة الذهبية):
إذا قال لك الزبون: "لقيتها فـ بلاصة أخرى بـ 100 ولا 120 درهم"، أو "السوق رخص منكم":
جاوبو بهاد النبرة الواثقة والمحترمة تماماً:
"إلا لقيتي أخويا نفس هاد الجودة العالية (سوميلة ݣومة، وخياطة من الداخل، ومخدومة بلانجيكسيون العالي) وبثمن قل، سير أخويا الله ييسر ليك خوذها من عندهم! حنا سلعتنا نقية وأوريجينال وضامنين الجودة ديالها، وفوق هادشي التوصيل فابور وكتشوف السلعة بعينيك عاد كتخلص."

📸 إرسال الصور:
إذا طلب الزبون صوراً أو رؤية السلعة ("صيفط التصاور"، "وريني"، "كيف دايرة"):
استعمل التاغ: [SEND_IMAGE: رابط_الصورة] في نهاية أو وسط الرد.

📝 إتمام الطلب وتأكيده (Order Registration):
عندما يقدم الزبون معلوماته (الاسم، المدينة، المقاس، اللون، أو الكمية) ويؤكد الشراء:
1. اشكره بلباقة وأكد له أن الطلبية مسجلة وغادي يتاصل به الموزع باش يوصلها ليه فابور.
2. ضع في نهاية ردك تاغ الطلب بصيغة JSON:
[CREATE_ORDER: {"name": "الاسم", "city": "المدينة", "size": "المقاس", "color": "اللون", "quantity": 1, "phone": "رقم_الهاتف"}]`;

  // 4. Update bot_settings in Supabase
  const { data: existingSettings } = await supabase.from("bot_settings").select("id").limit(1).single();

  let botResult;
  if (existingSettings?.id) {
    botResult = await supabase
      .from("bot_settings")
      .update({
        is_active: true,
        system_prompt: fullSystemPrompt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSettings.id);
  } else {
    botResult = await supabase
      .from("bot_settings")
      .insert({
        is_active: true,
        system_prompt: fullSystemPrompt,
      });
  }

  if (botResult.error) {
    console.error("Error saving bot settings:", botResult.error);
  } else {
    console.log("Bot settings updated successfully in Supabase!");
  }
}

main().catch(console.error);
