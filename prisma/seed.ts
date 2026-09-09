/**
 * Seed script — run with: bun run prisma/seed.ts
 * (Bun auto-loads .env from project root; PrismaClient reads DATABASE_URL.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IMAGES = [
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/16e2e26e2d2f.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0ebaa6145dcb.jpeg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/60716d5bb2e0.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6fdca56479ce.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b7f0de266de9.png",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8fa13a4e54cc.jpg",
];

const TEMPLATES: { key: string; bodyAr: string }[] = [
  {
    key: "confirm_1",
    bodyAr:
      "سلام {name} 👋\nوصلنا طلبك ديال {product} مقاس {size} ✅\n💰 {total} درهم — الدفع عند الاستلام\n📍 {city}\n📏 المقاس عندك التبديل ديالو مجاني إلا ماجاكش\n\nجاوب بـ *1* للتأكيد ولا *2* للإلغاء 🙏",
  },
  {
    key: "followup_2",
    bodyAr:
      "سلام {name} 🙏 مازال مقفلين معانا فتأكيد {product}...\nالكمية محدودة — جاوب *1* للتأكيد / *2* للإلغاء",
  },
  {
    key: "followup_3",
    bodyAr:
      "آخر رسالة 🙏 إلا ما تأكدش الطلب ديال {product} هاد اليوم غنلغيو من النظام.\n*1* تأكيد / *2* إلغاء",
  },
  {
    key: "day_before",
    bodyAr:
      "سلام {name} ✅ الطلب ديال {product} غيخرج غدا للتوصيل 🚚\nجاوب *1* باش نأكدو، ورجاك يكون متوفر على الرقم 🙏",
  },
  { key: "shipped", bodyAr: "طلبك فالطريق 🚚 رقم التتبع: {tracking}" },
  {
    key: "thanks",
    bodyAr: "شكرا على الثقة 🙏 إلا عجبك المقاس والتصميم شاركهم مع صحابك 😉",
  },
  {
    key: "returned_sorry",
    bodyAr:
      "سلام {name} 🙏 وصلك الطلب ماشي مقاسك؟ ماشي مشكل — التبديل مجاني. جاوبنا فواتساب ونرتبو ليك التبديل.",
  },
];

function daysAgo(days: number, hour = 12, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3600 * 1000);
}

function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface SeedOrder {
  name: string;
  phone: string;
  city: string;
  district?: string;
  landmark?: string;
  size: string;
  color: string;
  quantity: number;
  status: string;
  createdAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  shipDate?: Date;
  courierName?: string;
  tracking?: string;
  notes?: string;
  returnReason?: string;
  confirmedAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}

const COURIERS = [
  { name: "أمانة", contact: "0522-XXXX", feePerDeliveryMad: 35, feePerReturnMad: 18 },
  { name: "Ozone", contact: null, feePerDeliveryMad: 25, feePerReturnMad: 12 },
  { name: "CTM", contact: null, feePerDeliveryMad: 30, feePerReturnMad: 15 },
];

const ORDERS: SeedOrder[] = [
  // ── 6 delivered ──────────────────────────────────────────────
  {
    name: "يوسف العلمي", phone: "0661234501", city: "الدار البيضاء", district: "حي المعاريف",
    size: "42", color: "أبيض", quantity: 1, status: "delivered",
    createdAt: daysAgo(28), attempts: 1, lastAttemptAt: daysAgo(28, 10),
    courierName: "أمانة", confirmedAt: daysAgo(28, 14), shippedAt: daysAgo(26), deliveredAt: daysAgo(24),
  },
  {
    name: "خديجة بناني", phone: "0665432102", city: "الرباط", size: "39", color: "أسود",
    quantity: 1, status: "delivered",
    createdAt: daysAgo(24), attempts: 0, confirmedAt: daysAgo(24, 15),
    courierName: "Ozone", shippedAt: daysAgo(22), deliveredAt: daysAgo(20),
  },
  {
    name: "محمد الأعرج", phone: "0770123453", city: "مراكش", landmark: "قرب جامع الكتبية",
    size: "43", color: "بيج", quantity: 2, status: "delivered",
    createdAt: daysAgo(20), attempts: 1, lastAttemptAt: daysAgo(20, 9),
    courierName: "CTM", confirmedAt: daysAgo(20, 13), shippedAt: daysAgo(18), deliveredAt: daysAgo(16),
  },
  {
    name: "سعاد التازي", phone: "0669876504", city: "فاس", size: "40", color: "أبيض",
    quantity: 1, status: "delivered",
    createdAt: daysAgo(15), attempts: 0, confirmedAt: daysAgo(15, 16),
    courierName: "أمانة", shippedAt: daysAgo(13), deliveredAt: daysAgo(11),
  },
  {
    name: "أيوب مرابط", phone: "0771234505", city: "طنجة", district: "حي المصلى",
    size: "44", color: "أسود", quantity: 1, status: "delivered",
    createdAt: daysAgo(9), attempts: 1, lastAttemptAt: daysAgo(9, 11),
    courierName: "Ozone", confirmedAt: daysAgo(9, 15), shippedAt: daysAgo(7), deliveredAt: daysAgo(5),
  },
  {
    name: "نادية الشرقاوي", phone: "0663456706", city: "أكادير", size: "39", color: "بيج",
    quantity: 1, status: "delivered", notes: "الزبونة طابت الجلسة معاها",
    createdAt: daysAgo(6), attempts: 0, confirmedAt: daysAgo(6, 14),
    courierName: "أمانة", shippedAt: daysAgo(4), deliveredAt: daysAgo(2),
  },
  // ── 2 returned (blacklisted phone 0611223344) ────────────────
  {
    name: "رضى المنصوري", phone: "0611223344", city: "مكناس", size: "41", color: "أبيض",
    quantity: 1, status: "returned", returnReason: "size",
    createdAt: daysAgo(25), attempts: 1, lastAttemptAt: daysAgo(25, 10),
    courierName: "أمانة", confirmedAt: daysAgo(25, 13), shippedAt: daysAgo(23), deliveredAt: daysAgo(21),
    notes: "⚠️ رقم فالبلاك ليست",
  },
  {
    name: "سلمى بنكيران", phone: "0611223344", city: "وجدة", size: "42", color: "أسود",
    quantity: 1, status: "returned", returnReason: "changed_mind",
    createdAt: daysAgo(12), attempts: 2, lastAttemptAt: daysAgo(12, 9),
    courierName: "CTM", confirmedAt: daysAgo(12, 14), shippedAt: daysAgo(10), deliveredAt: daysAgo(8),
    notes: "⚠️ رقم فالبلاك ليست",
  },
  // ── 1 canceled ───────────────────────────────────────────────
  {
    name: "حمزة الفاسي", phone: "0678765408", city: "القنيطرة", size: "43", color: "بيج",
    quantity: 1, status: "canceled",
    createdAt: daysAgo(18), attempts: 2, lastAttemptAt: daysAgo(17, 10),
  },
  // ── 2 shipped (one with shipDate tomorrow + tracking) ────────
  {
    name: "إيمان الصقلي", phone: "0670123409", city: "تطوان", size: "40", color: "أبيض",
    quantity: 1, status: "shipped", tracking: "TRK88231",
    createdAt: daysAgo(4), attempts: 0, confirmedAt: daysAgo(4, 16),
    courierName: "Ozone", shipDate: tomorrow(), shippedAt: daysAgo(1),
  },
  {
    name: "عمر بلحاج", phone: "0669988710", city: "سلا", size: "45", color: "أسود",
    quantity: 2, status: "shipped", tracking: "TRK90412",
    createdAt: daysAgo(3), attempts: 1, lastAttemptAt: daysAgo(3, 9),
    courierName: "أمانة", confirmedAt: daysAgo(3, 14), shipDate: daysAgo(1), shippedAt: daysAgo(1),
  },
  // ── 1 confirmed with shipDate tomorrow (double-confirm demo) ─
  {
    name: "ليلى مالك", phone: "0662345611", city: "تمارة", size: "39", color: "بيج",
    quantity: 1, status: "confirmed", attempts: 1, lastAttemptAt: daysAgo(1, 10),
    confirmedAt: daysAgo(1, 15), shipDate: tomorrow(), notes: "طلبات كثيرة هاد الأسبوع",
  },
  // ── 1 postponed ──────────────────────────────────────────────
  {
    name: "كريم الوزاني", phone: "0776543212", city: "الناظور", size: "41", color: "أسود",
    quantity: 1, status: "postponed", attempts: 1, lastAttemptAt: daysAgo(2, 11),
    notes: "قال غادي يسافر ويرجع بعد أسبوع",
    createdAt: daysAgo(5),
  },
  // ── 2 no_answer (attempts 1, lastAttemptAt 4h ago) ───────────
  {
    name: "سارة بوزيان", phone: "0665678913", city: "خريبكة", size: "42", color: "أبيض",
    quantity: 1, status: "no_answer", attempts: 1, lastAttemptAt: hoursAgo(4),
    createdAt: daysAgo(1, 9),
  },
  {
    name: "مهدي الرامي", phone: "0778123414", city: "سطات", size: "40", color: "بيج",
    quantity: 1, status: "no_answer", attempts: 1, lastAttemptAt: hoursAgo(4),
    createdAt: daysAgo(1, 10),
  },
  // ── 2 new (today, attempts 0) ────────────────────────────────
  {
    name: "رجاء بنتاش", phone: "0664567815", city: "برشيد", size: "43", color: "أبيض",
    quantity: 1, status: "new", attempts: 0, createdAt: hoursAgo(2),
  },
  {
    name: "أنس الحسني", phone: "0770012316", city: "الدار البيضاء", district: "حي سيدي معروف",
    size: "44", color: "أسود", quantity: 2, status: "new", attempts: 0, createdAt: hoursAgo(1),
  },
];

const AD_SPENDS = [120, 150, 200, 80, 250, 180, 90, 160, 220, 140, 110, 130, 170, 100];

// pricing: unit 150 MAD, pair offer 220 MAD (discount 80 per complete pair)
const UNIT_PRICE = 150;
const OFFER_QTY = 2;
const OFFER_TOTAL = 220;
const discountFor = (q: number) =>
  Math.floor(q / OFFER_QTY) * (OFFER_QTY * UNIT_PRICE - OFFER_TOTAL);

async function main() {
  console.log("🌱 Seeding…");

  // wipe in FK-safe order
  await prisma.orderEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.dailyAdSpend.deleteMany();
  await prisma.blacklistEntry.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.product.deleteMany();

  const product = await prisma.product.create({
    data: {
      name: "حذاء رياضي Urban Step",
      priceMad: UNIT_PRICE,
      oldPriceMad: null,
      offerQty: OFFER_QTY,
      offerTotalMad: OFFER_TOTAL,
      costMad: 85,
      sizes: JSON.stringify(["39", "40", "41", "42", "43", "44", "45"]),
      colors: JSON.stringify([
        { name: "أبيض", hex: "#f5f5f4" },
        { name: "أسود", hex: "#1c1917" },
        { name: "بيج", hex: "#d6c8b5" },
      ]),
      imageUrls: JSON.stringify(IMAGES),
      active: true,
    },
  });

  for (const t of TEMPLATES) {
    await prisma.messageTemplate.create({ data: t });
  }

  const courierMap = new Map<string, string>();
  for (const c of COURIERS) {
    const created = await prisma.courier.create({ data: c });
    courierMap.set(c.name, created.id);
  }

  await prisma.blacklistEntry.create({
    data: {
      phone: "0611223344",
      strikes: 2,
      reasons: JSON.stringify(["returned", "returned"]),
    },
  });

  let orderNumber = 1;
  for (const o of ORDERS) {
    const order = await prisma.order.create({
      data: {
        orderNumber: orderNumber,
        customerName: o.name,
        phone: o.phone,
        city: o.city,
        district: o.district,
        landmark: o.landmark,
        productId: product.id,
        size: o.size,
        color: o.color,
        quantity: o.quantity,
        unitPriceMad: UNIT_PRICE,
        discountMad: discountFor(o.quantity),
        status: o.status,
        attempts: o.attempts,
        lastAttemptAt: o.lastAttemptAt,
        shipDate: o.shipDate,
        courierId: o.courierName ? courierMap.get(o.courierName) : null,
        tracking: o.tracking,
        notes: o.notes,
        returnReason: o.returnReason,
        createdAt: o.createdAt,
        confirmedAt: o.confirmedAt,
        shippedAt: o.shippedAt,
        deliveredAt: o.deliveredAt,
      },
    });

    // events: created + whatsapp_click (when attempted) + status_change trail
    const events: { type: string; detail?: string; createdAt: Date }[] = [
      { type: "created", createdAt: o.createdAt },
    ];
    if (o.attempts > 0 && o.lastAttemptAt) {
      events.push({
        type: "whatsapp_click",
        detail: JSON.stringify({
          templateKey: o.attempts >= 2 ? "followup_3" : o.attempts === 1 ? "followup_2" : "confirm_1",
        }),
        createdAt: o.lastAttemptAt,
      });
    }
    if (o.confirmedAt) {
      events.push({
        type: "status_change",
        detail: JSON.stringify({ from: "new", to: "confirmed" }),
        createdAt: o.confirmedAt,
      });
    }
    if (o.shippedAt) {
      events.push({
        type: "status_change",
        detail: JSON.stringify({ from: "confirmed", to: "shipped" }),
        createdAt: o.shippedAt,
      });
    }
    if (o.deliveredAt) {
      events.push({
        type: "status_change",
        detail: JSON.stringify({ from: "shipped", to: o.status }),
        createdAt: o.deliveredAt,
      });
    }
    if (o.status === "canceled" && o.lastAttemptAt) {
      events.push({
        type: "status_change",
        detail: JSON.stringify({ from: "new", to: "canceled" }),
        createdAt: new Date(o.lastAttemptAt.getTime() + 3600 * 1000),
      });
    }
    for (const ev of events) {
      await prisma.orderEvent.create({
        data: { orderId: order.id, type: ev.type, detail: ev.detail, createdAt: ev.createdAt },
      });
    }
    orderNumber++;
  }

  for (let i = 0; i < AD_SPENDS.length; i++) {
    const d = daysAgo(AD_SPENDS.length - 1 - i, 0, 0);
    await prisma.dailyAdSpend.create({
      data: { date: d, amountMad: AD_SPENDS[i] },
    });
  }

  console.log(
    `✅ Done: 1 product, ${TEMPLATES.length} templates, ${COURIERS.length} couriers, ${ORDERS.length} orders, ${AD_SPENDS.length} ad-spend days`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
