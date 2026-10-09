import fs from "fs";

// Load .env.local manually
if (fs.existsSync(".env.local")) {
  const envConfig = fs.readFileSync(".env.local", "utf8");
  envConfig.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim();
        process.env[key] = value;
      }
    }
  });
}

const token = process.env.WHATSAPP_API_TOKEN?.trim();
const phone_number_id = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
const admin_phone = (process.env.ADMIN_WHATSAPP_PHONE || "212610026260").replace(/\D/g, "");

console.log("Using phone_number_id:", phone_number_id);
console.log("Target admin phone:", admin_phone);

if (!token || !phone_number_id) {
  console.error("Missing WhatsApp token or phone_number_id!");
  process.exit(1);
}

const url = `https://graph.facebook.com/v21.0/${phone_number_id}/messages`;

const messageBody = `👋 السلام عليكم أخ أيوب،
هذا اختبار تجريبي لنظام تنبيهات الأدمن من البوت (WhatsApp Bot Alert Test).
الربط شغال 100% ورقمك مسجل بنجاح لتلقي أي تقرير أو عطب تقني فوري في النظام. ✅

الوقت: ${new Date().toLocaleString("ar-MA", { timeZone: "Africa/Casablanca" })}`;

const payload = {
  messaging_product: "whatsapp",
  to: admin_phone,
  type: "text",
  text: { body: messageBody },
};

async function run() {
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
    console.log("Status:", response.status, response.statusText);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log("✅ Test WhatsApp message sent successfully to Admin!");
    } else {
      console.error("❌ Failed to send WhatsApp message.");
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

run();
