import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { normalizeMaPhone } from "@/lib/phone";
import { toOrderDTO, parseJsonArray } from "@/lib/serialize";
import { parseOrdersFilters, buildOrdersWhere, PAGE_SIZE } from "@/lib/orders-query";
import { MOROCCAN_CITIES } from "@/lib/constants";
import type { OrdersResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/* ─────────────────────────── GET (admin) ─────────────────────────── */

export async function GET(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  const url = new URL(req.url);
  const filters = parseOrdersFilters(url.searchParams);
  const where = buildOrdersWhere(filters);
  const page = filters.page ?? 1;

  const [orders, total, blacklist] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: true, courier: true },
    }),
    db.order.count({ where }),
    db.blacklistEntry.findMany({ select: { phone: true } }),
  ]);

  const res: OrdersResponse = {
    orders: orders.map((o) => toOrderDTO(o)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    blacklistPhones: blacklist.map((b) => b.phone),
  };
  return NextResponse.json(res);
}

/* ─────────────────────────── POST (public) ─────────────────────────── */

const createSchema = z.object({
  name: z.string().trim().min(3, "الاسم قصير بزاف"),
  phone: z.string().trim().min(9, "رقم الهاتف ناقص"),
  city: z.string().trim().min(2, "المدينة مطلوبة"),
  size: z.string().trim().min(1, "المقاس مطلوب"),
  color: z.string().trim().optional().nullable(),
  quantity: z.number().int().min(1).max(3),
  district: z.string().trim().optional().nullable(),
  landmark: z.string().trim().optional().nullable(),
  productId: z.string().optional(),
  notes: z.string().trim().optional().nullable(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "المعلومات ناقصة", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // phone: normalize then validate Moroccan mobile
  const phone = normalizeMaPhone(data.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "رقم الهاتف خاصو يكون رقم مغربي صحيح (06/07)" },
      { status: 400 }
    );
  }

  if (!MOROCCAN_CITIES.includes(data.city as (typeof MOROCCAN_CITIES)[number])) {
    return NextResponse.json({ error: "المدينة غير معروفة" }, { status: 400 });
  }

  // product: explicit or first active
  const product = data.productId
    ? await db.product.findFirst({ where: { id: data.productId, active: true } })
    : await db.product.findFirst({ where: { active: true } });
  if (!product) {
    return NextResponse.json({ error: "المنتج غير متوفر" }, { status: 400 });
  }

  const sizes = parseJsonArray<string>(product.sizes);
  if (!sizes.includes(data.size)) {
    return NextResponse.json({ error: "المقاس غير متوفر" }, { status: 400 });
  }

  // silent blacklist check — order still accepted, seller sees the flag
  const blacklist = await db.blacklistEntry.findUnique({ where: { phone } });
  const notes = [
    data.notes,
    blacklist ? "⚠️ رقم فالبلاك ليست" : null,
  ]
    .filter(Boolean)
    .join(" | ") || null;

  const maxOrder = await db.order.aggregate({
    _max: { orderNumber: true },
  });

  const order = await db.order.create({
    data: {
      orderNumber: (maxOrder._max.orderNumber ?? 0) + 1,
      customerName: data.name,
      phone,
      city: data.city,
      district: data.district || null,
      landmark: data.landmark || null,
      productId: product.id,
      size: data.size,
      color: data.color || null,
      quantity: data.quantity,
      unitPriceMad: product.priceMad,
      status: "new",
      notes,
    },
  });

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: "created",
      detail: JSON.stringify({ source: "landing" }),
    },
  });

  return NextResponse.json(
    { orderNumber: order.orderNumber, id: order.id },
    { status: 201 }
  );
}
