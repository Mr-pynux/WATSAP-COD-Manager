import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MA_PHONE_REGEX } from "@/lib/phone";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, name, phone, city, district, landmark, size, color, quantity, paymentMethod } = body;

    if (!name || !phone || !city || !size || !productId) {
      return NextResponse.json({ error: "معلومات ناقصة" }, { status: 400 });
    }
    if (!MA_PHONE_REGEX.test(phone)) {
      return NextResponse.json({ error: "رقم الهاتف غير صحيح" }, { status: 400 });
    }

    // Use Service Role Key to bypass RLS for creating events
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch product to get unit price
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("price_mad")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 });
    }

    // 2. Insert order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: name,
        phone,
        city,
        district: district || null,
        landmark: landmark || null,
        product_id: productId,
        size,
        color: color || null,
        quantity: quantity || 1,
        unit_price_mad: paymentMethod !== "cod" ? product.price_mad - 10 : product.price_mad,
        payment_method: paymentMethod || "cod",
        status: "new",
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("Order Insert Error:", orderError);
      return NextResponse.json({ error: "فشل تسجيل الطلب" }, { status: 500 });
    }

    // 3. Insert order event
    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      type: "created",
      detail: { source: "landing_page" },
    });

    return NextResponse.json({ orderNumber: order.order_number });
  } catch (error) {
    console.error("Orders API Error:", error);
    return NextResponse.json({ error: "خطأ في السيرفر" }, { status: 500 });
  }
}
