import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Ruler,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatTotal } from "@/lib/whatsapp";

export const metadata = {
  title: "تم تسجيل طلبك — ShoeSpot",
};

interface SuccessPageProps {
  searchParams: Promise<{ n?: string }>;
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { n } = await searchParams;
  const seller = process.env.NEXT_PUBLIC_SELLER_WHATSAPP || "212600000000";

  // Load the full order so the customer can forward it to the seller's WhatsApp
  let order = null as null | {
    customerName: string;
    phone: string;
    city: string;
    district: string | null;
    landmark: string | null;
    size: string;
    color: string | null;
    quantity: number;
    unitPriceMad: number;
    discountMad: number;
    product: { name: string };
  };
  const orderNo = n && !Number.isNaN(Number(n)) ? Number(n) : null;
  if (orderNo) {
    try {
      order = await db.order.findFirst({
        where: { orderNumber: orderNo },
        include: { product: { select: { name: true } } },
      });
    } catch {
      // DB hiccup — generic message fallback
    }
  }

  const total = order
    ? formatTotal(order.quantity, order.unitPriceMad, order.discountMad)
    : null;

  // Full order summary → lands pre-written in the seller's WhatsApp chat
  const messageLines = [
    `طلب جديد من موقع ShoeSpot — رقم ORD-${n ?? "؟"}`,
    order ? `المنتج: ${order.product.name}` : null,
    order ? `المقاس: ${order.size}${order.color ? ` | اللون: ${order.color}` : ""}` : null,
    order ? `الكمية: ${order.quantity}` : null,
    total ? `المجموع: ${total} درهم (الدفع عند الاستلام + التوصيل فابور)` : null,
    order ? `الزبون: ${order.customerName}` : null,
    order ? `الهاتف: ${order.phone}` : null,
    order
      ? `المدينة: ${order.city}${order.district ? ` — ${order.district}` : ""}${
          order.landmark ? ` (${order.landmark})` : ""
        }`
      : null,
  ].filter((l): l is string => Boolean(l));
  const waUrl = `https://wa.me/${seller}?text=${encodeURIComponent(messageLines.join("\n"))}`;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background p-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/50 p-6">
            <CheckCircle2 className="h-16 w-16 text-emerald-600" aria-hidden="true" />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">
          تم تسجيل طلبك بنجاح!
        </h1>

        {n && (
          <p className="text-lg font-semibold bg-muted rounded-lg py-3 px-4 inline-block">
            رقم الطلب: <span className="ltr-num">#{`ORD-${n}`}</span>
          </p>
        )}

        {/* order summary card */}
        {order && (
          <div className="text-right bg-card border rounded-xl p-4 space-y-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-bold">{order.product.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Ruler className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                المقاس <span className="ltr-num font-semibold">{order.size}</span>
                {order.color ? ` — ${order.color}` : ""} ×
                <span className="ltr-num font-semibold"> {order.quantity}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold">
                {order.city}
                {order.district ? ` — ${order.district}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Banknote className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-bold text-emerald-700 dark:text-emerald-400 ltr-num">
                {total} درهم
              </span>
              <span className="text-muted-foreground">— الدفع عند الاستلام</span>
            </div>
          </div>
        )}

        <p className="text-muted-foreground text-lg leading-relaxed">
          دغيا غادي يتصل بيك البائع على واتساب باش يأكد الطلب معاك
        </p>

        <div className="space-y-3 pt-2">
          <Button
            asChild
            size="lg"
            className="w-full h-12 bg-wa text-wa-foreground hover:bg-wa/90"
          >
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" />
              أرسل الطلب ديالك للبائع فواتساب
            </a>
          </Button>

          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <Phone className="h-3 w-3" />
            كتصل على الزر كيتفتح واتساب والطلب كامل مكتوب — غير صيفط
          </p>

          <Button asChild variant="outline" size="lg" className="w-full h-12">
            <Link href="/">
              <ArrowRight className="h-5 w-5" />
              الرجوع للمتجر
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
