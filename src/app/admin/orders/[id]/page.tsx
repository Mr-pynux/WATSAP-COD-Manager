import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { getOrderByIdServer } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { fmtDate } from "@/lib/format";
import { STATUS_LABELS, type OrderStatus } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrderByIdServer(id);

  if (!order) {
    notFound();
  }

  const items = order.items && order.items.length > 0 ? order.items : [
    {
      productId: order.productId,
      name: order.product.name,
      size: order.size,
      color: order.color,
      quantity: order.quantity,
      priceMad: order.unitPriceMad,
      imageUrl: order.product.imageUrls?.[0] || null,
    }
  ];

  const isBundle = items.length > 1;
  const waPhone = order.phone.startsWith("0") ? "212" + order.phone.slice(1) : order.phone;
  const waUrl = `https://wa.me/${waPhone}`;
  const telUrl = `tel:${order.phone}`;

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders">
            <Button variant="outline" size="sm" className="gap-1.5 h-9">
              <ArrowRight className="h-4 w-4" />
              الرجوع للطلبات
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              طلبية <span className="ltr-num">#{order.orderNumber}</span>
              <StatusBadge status={order.status} />
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              تاريخ التسجيل: <span className="ltr-num">{fmtDate(order.createdAt)}</span>
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <a href={telUrl}>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 px-4">
              <Phone className="h-4 w-4" />
              اتصال هاتفي
            </Button>
          </a>
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 px-4">
              <MessageCircle className="h-4 w-4" />
              محادثة واتساب
            </Button>
          </a>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Ordered Shoe Models & Photos */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  المنتجات المطلوبة ({items.length})
                </CardTitle>
                {isBundle && (
                  <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30 text-xs font-bold px-2.5 py-1">
                    🎁 عرض خاص ({Math.round(order.totalMad)} د.م)
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors shadow-2xs"
                >
                  {/* Shoe Photo */}
                  <div className="relative h-32 w-32 sm:h-28 sm:w-28 rounded-xl overflow-hidden border bg-muted shrink-0 shadow-xs flex items-center justify-center group">
                    {it.imageUrl ? (
                      <a
                        href={it.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-full w-full block cursor-zoom-in relative"
                        title="مشاهدة وتكبير الصورة"
                      >
                        <img
                          src={it.imageUrl}
                          alt={it.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </a>
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>

                  {/* Shoe Details */}
                  <div className="flex-1 text-center sm:text-start space-y-2 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      {it.productId ? (
                        <Link
                          href={`/admin/products/${it.productId}`}
                          className="font-bold text-base sm:text-lg text-foreground hover:text-primary transition-colors flex items-center justify-center sm:justify-start gap-1.5 group"
                          title="مشاهدة وتعديل المنتج"
                        >
                          <span>{it.name}</span>
                          <ExternalLink className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      ) : (
                        <h3 className="font-bold text-base sm:text-lg text-foreground">
                          {it.name}
                        </h3>
                      )}
                      <span className="font-bold text-lg ltr-num text-emerald-600 dark:text-emerald-400">
                        {Math.round((it.priceMad || order.unitPriceMad) * (it.quantity || 1))} د.م
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-sm font-bold px-3 py-1">
                        المقاس (النمرة): <span className="ltr-num ms-1.5 text-base">{it.size}</span>
                      </Badge>
                      {it.color && (
                        <Badge variant="outline" className="bg-muted text-sm font-medium px-3 py-1">
                          اللون: <span className="ms-1">{it.color}</span>
                        </Badge>
                      )}
                      <Badge variant="outline" className="bg-muted text-sm px-3 py-1 ltr-num">
                        الكمية: ×{it.quantity || 1}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}

              {/* Total Summary Box */}
              <div className="p-4 rounded-xl bg-muted/60 border flex items-center justify-between text-base">
                <span className="font-bold">المجموع الإجمالي للدفع عند الاستلام:</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 ltr-num">
                  {Math.round(order.totalMad)} د.م
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Notes Card */}
          {order.notes && (
            <Card className="border shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground">
                  ملاحظات الطلبية
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-foreground bg-muted/20 p-4 rounded-b-xl">
                {order.notes}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Customer Info & Delivery Details */}
        <div className="space-y-4">
          {/* Customer Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/30">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                معلومات الزبون والتوصيل
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">إسم الزبون:</span>
                <p className="font-bold text-base">{order.customerName}</p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">رقم الهاتف:</span>
                <p className="font-bold text-base ltr-num text-primary" dir="ltr">
                  {order.phone}
                </p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">المدينة:</span>
                <p className="font-bold text-base">{order.city}</p>
              </div>

              {(order.district || order.landmark) && (
                <div>
                  <span className="text-xs text-muted-foreground block">العنوان الدقيق:</span>
                  <p className="font-medium text-foreground">
                    {[order.district, order.landmark].filter(Boolean).join(" - ")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Logistics & Tracking Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/30">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                معلومات الشحن والتوصيل
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">حالة الطلب:</span>
                <StatusBadge status={order.status} />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">شركة التوصيل:</span>
                <span className="font-semibold">{order.courier?.name || "غير محدد"}</span>
              </div>

              {order.tracking && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">رقم التتبع:</span>
                  <span className="font-mono font-bold ltr-num">{order.tracking}</span>
                </div>
              )}

              {order.shipDate && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">تاريخ الشحن:</span>
                  <span className="ltr-num">{fmtDate(order.shipDate)}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <span>المحاولات: <b className="ltr-num text-foreground">{order.attempts}</b></span>
                {order.lastAttemptAt && (
                  <span>آخر محاولة: <span className="ltr-num">{fmtDate(order.lastAttemptAt)}</span></span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
