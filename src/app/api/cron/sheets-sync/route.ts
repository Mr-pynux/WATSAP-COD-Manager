import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncDataToSheet, getSheetData } from "@/lib/google-sheets";

// Prevent Vercel from caching this route
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Basic auth using cron secret
    const authHeader = req.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "GOOGLE_SHEET_ID is not set" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Sync Orders
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(`
        order_number,
        customer_name,
        phone,
        city,
        district,
        landmark,
        size,
        color,
        quantity,
        unit_price_mad,
        status,
        created_at,
        product:products(name)
      `)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (ordersError) {
      throw new Error("Failed to fetch orders: " + ordersError.message);
    }

    const ordersHeader = [
      "رقم الطلب",
      "التاريخ",
      "الزبون",
      "الهاتف",
      "المدينة",
      "العنوان",
      "المنتج",
      "المقاس",
      "اللون",
      "الكمية",
      "السعر (درهم)",
      "الحالة",
    ];

    const ordersRows = orders.map((o) => [
      o.order_number,
      new Date(o.created_at).toLocaleString("ar-MA"),
      o.customer_name,
      o.phone,
      o.city,
      [o.district, o.landmark].filter(Boolean).join(" - "),
      o.product ? (o.product as any).name : "",
      o.size,
      o.color || "",
      o.quantity,
      o.unit_price_mad,
      o.status,
    ]);

    await syncDataToSheet(spreadsheetId, "Orders!A1", [ordersHeader, ...ordersRows]);

    // 2. Sync Products (Inventory)
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (productsError) {
      throw new Error("Failed to fetch products: " + productsError.message);
    }

    // Fetch existing sheet data to preserve manual stock inputs
    const existingProductsSheetData = await getSheetData(spreadsheetId, "Products!A1:Z");
    const stockMap: Record<string, { [key: string]: string }> = {};
    
    if (existingProductsSheetData.length > 1) {
      const headers = existingProductsSheetData[0];
      const idIndex = headers.indexOf("الرقم المرجعي");
      const s39Index = headers.indexOf("المقاس 39");
      const s40Index = headers.indexOf("المقاس 40");
      const s41Index = headers.indexOf("المقاس 41");
      const s42Index = headers.indexOf("المقاس 42");
      const s43Index = headers.indexOf("المقاس 43");
      const s44Index = headers.indexOf("المقاس 44");
      const s45Index = headers.indexOf("المقاس 45");
      
      if (idIndex !== -1) {
        for (let i = 1; i < existingProductsSheetData.length; i++) {
          const row = existingProductsSheetData[i];
          const productId = row[idIndex];
          if (productId) {
            stockMap[productId] = {
              '39': s39Index !== -1 && row[s39Index] !== undefined ? row[s39Index] : "",
              '40': s40Index !== -1 && row[s40Index] !== undefined ? row[s40Index] : "",
              '41': s41Index !== -1 && row[s41Index] !== undefined ? row[s41Index] : "",
              '42': s42Index !== -1 && row[s42Index] !== undefined ? row[s42Index] : "",
              '43': s43Index !== -1 && row[s43Index] !== undefined ? row[s43Index] : "",
              '44': s44Index !== -1 && row[s44Index] !== undefined ? row[s44Index] : "",
              '45': s45Index !== -1 && row[s45Index] !== undefined ? row[s45Index] : "",
            };
          }
        }
      }
    }

    const productsHeader = [
      "الرقم المرجعي",
      "المنتج",
      "المقاس 39",
      "المقاس 40",
      "المقاس 41",
      "المقاس 42",
      "المقاس 43",
      "المقاس 44",
      "المقاس 45",
      "السعر (درهم)",
      "التكلفة (درهم)",
      "المقاسات المتاحة",
      "الألوان المتاحة",
      "نشط",
    ];

    const productsRows = products.map((p) => [
      p.id,
      p.name,
      stockMap[p.id]?.['39'] || "",
      stockMap[p.id]?.['40'] || "",
      stockMap[p.id]?.['41'] || "",
      stockMap[p.id]?.['42'] || "",
      stockMap[p.id]?.['43'] || "",
      stockMap[p.id]?.['44'] || "",
      stockMap[p.id]?.['45'] || "",
      p.price_mad,
      p.cost_mad,
      (p.sizes || []).join(", "),
      (p.colors || []).map((c: any) => c.name).join(", "),
      p.active ? "نعم" : "لا",
    ]);

    await syncDataToSheet(spreadsheetId, "Products!A1", [productsHeader, ...productsRows]);

    return NextResponse.json({ success: true, message: "Synced successfully" });
  } catch (error: any) {
    console.error("Sheets Sync Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
