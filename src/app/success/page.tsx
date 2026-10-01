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
    paymentMethod: string;
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
    total ? `المجموع: ${total} درهم (${order?.paymentMethod === "cod" ? "الدفع عند الاستلام" : order?.paymentMethod === "paypal" ? "دفع مسبق عبر PayPal" : "دفع مسبق عبر تحويل بنكي"})` : null,
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
              <span className="text-muted-foreground">— {order.paymentMethod === "cod" ? "الدفع عند الاستلام" : order.paymentMethod === "paypal" ? "دفع عبر PayPal" : "تحويل بنكي"}</span>
            </div>
          </div>
        )}

        {order?.paymentMethod === "paypal" ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center space-y-4 shadow-sm">
            <h3 className="text-xl font-bold text-blue-800">خطوة أخيرة لتأكيد الطلب!</h3>
            <p className="text-blue-700 text-sm font-semibold">
              المرجو إرسال مبلغ <span className="ltr-num font-bold bg-blue-100 px-1 rounded">{total} درهم</span> عبر الرابط أسفله لتأكيد الطلب والاستفادة من الخصم:
            </p>
            <Button asChild className="w-full bg-[#0070ba] hover:bg-[#003087] text-white font-bold h-12 shadow-md">
              <a href={`https://paypal.me/AyoubZiani959/${total}`} target="_blank" rel="noopener noreferrer">
                ادفع الآن عبر PayPal
              </a>
            </Button>
            <p className="text-xs text-blue-600/80">
              بعد الدفع، سنتصل بك مباشرة عبر الواتساب لتأكيد الإرسال.
            </p>
          </div>
        ) : order?.paymentMethod === "rib" ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-4 shadow-sm">
            <h3 className="text-xl font-bold text-emerald-800">خطوة أخيرة لتأكيد الطلب!</h3>
            <p className="text-emerald-700 text-sm font-semibold">
              المرجو تحويل مبلغ <span className="ltr-num font-bold bg-emerald-100 px-1 rounded">{total} درهم</span> إلى الحساب البنكي التالي:
            </p>
            <div className="bg-white p-3 rounded-lg border border-emerald-100 space-y-2">
              <p className="text-xs text-stone-500 font-semibold">رقم الحساب (RIB)</p>
              <p className="font-mono text-lg font-bold tracking-wider ltr-num select-all">230 780 6181229211002400 90</p>
            </div>
            <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 shadow-md">
              <a href={waUrl} target="_blank" rel="noopener noreferrer">
                إرسال وصل الدفع عبر الواتساب
              </a>
            </Button>
            <p className="text-xs text-emerald-600/80 font-medium">
              بمجرد إرسال وصل الدفع (Reçu) في الواتساب، سيتم شحن طلبك فوراً!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-lg leading-relaxed font-semibold">
              دغيا غادي يتصل بيك البائع على واتساب باش يأكد الطلب معاك
            </p>
            <p className="text-stone-500 text-sm">
              فترة تأكيد الطلبيات كتمتد من ورا الظهر حتى لصلاة العصر، المرجو الانتباه لهاتفك!
            </p>
          </div>
        )}

        <div className="space-y-3 pt-2">
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
