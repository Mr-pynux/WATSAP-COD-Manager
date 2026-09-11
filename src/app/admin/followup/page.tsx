"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  PhoneCall,
  Clock,
  CalendarClock,
  CheckCheck,
  XCircle,
  Loader2,
  BellRing,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { WaButton } from "@/components/admin/wa-button";
import { STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import type { OrderDTO } from "@/lib/types";
import { getFollowupServer, logConfirmedTodayServer, type FollowupResponse } from "./actions";
import { updateOrderStatusServer } from "../orders/actions";

type QueueOrder = OrderDTO & { suggestedTemplateKey?: string };



const HOUR = 3600 * 1000;

function hoursSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / HOUR;
}

function groupKey(order: QueueOrder): "24h" | "3h" | "recent" {
  const h = hoursSince(order.lastAttemptAt);
  if (h > 24) return "24h";
  if (h >= 3) return "3h";
  return "recent";
}

const GROUPS: { key: "24h" | "3h" | "recent"; label: string; hint: string }[] = [
  { key: "24h", label: "+24 ساعة", hint: "مازال ماجاوبش من أكثر من نهار — صيفط آخر متابعة" },
  { key: "3h", label: "+3 ساعات", hint: "من 3 لـ 24 ساعة على آخر محاولة" },
  { key: "recent", label: "حديثة", hint: "أقل من 3 ساعات — عطيها وقت" },
];

export default function FollowupPage() {
  const [data, setData] = useState<FollowupResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getFollowupServer();
      setData(res);
    } catch {
      toast.error("تعذر تحميل قائمة المتابعة");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function quickStatus(order: OrderDTO, status: OrderStatus) {
    setBusyId(order.id);
    try {
      await updateOrderStatusServer(order.id, status);
      toast.success(`الطلب #${order.orderNumber} ولّى ${STATUS_LABELS[status]}`);
      await load();
    } catch {
      toast.error("تعذر تغيير الحالة");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmedToday(order: OrderDTO) {
    setBusyId(order.id);
    try {
      await logConfirmedTodayServer(order.id);
      toast.success("تسجل التأكيد ديال اليوم");
      await load();
    } catch {
      toast.error("تعذر تسجيل التأكيد");
    } finally {
      setBusyId(null);
    }
  }

  if (!data) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const groups = GROUPS.map((g) => ({
    ...g,
    orders: data.queue.filter((o) => groupKey(o) === g.key),
  }));

  return (
    <Tabs defaultValue="followup" dir="rtl">
      <TabsList className="w-full grid grid-cols-2 mb-4">
        <TabsTrigger value="followup" className="gap-1.5">
          <PhoneCall className="h-4 w-4" />
          المتابعة
          <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30 ltr-num">
            {data.counts.queue}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="double" className="gap-1.5">
          <BellRing className="h-4 w-4" />
          التأكيد المزدوج
          <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30 ltr-num">
            {data.counts.doubleConfirm}
          </Badge>
        </TabsTrigger>
      </TabsList>

      {/* ── Tab 1: follow-up queue ─────────────────────── */}
      <TabsContent value="followup" className="space-y-6">
        {data.queue.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              ماكاينش طلبات فالمتابعة — كلشي مزيان
            </CardContent>
          </Card>
        )}

        {groups.map((g) =>
          g.orders.length > 0 ? (
            <section key={g.key} className="space-y-3">
              <div className="flex items-center gap-2">
                {g.key === "24h" ? (
                  <Clock className="h-5 w-5 text-rose-500" />
                ) : g.key === "3h" ? (
                  <Clock className="h-5 w-5 text-amber-500" />
                ) : (
                  <Clock className="h-5 w-5 text-emerald-500" />
                )}
                <h2 className="font-bold text-lg">
                  {g.label}{" "}
                  <span className="text-muted-foreground font-normal text-sm ltr-num">
                    ({g.orders.length})
                  </span>
                </h2>
              </div>
              <p className="text-xs text-muted-foreground -mt-2 ps-7">{g.hint}</p>

              <div className="space-y-3">
                {g.orders.map((o) => (
                  <Card key={o.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold ltr-num">#{o.orderNumber}</span>
                          <span className="font-semibold ms-2">{o.customerName}</span>
                          <p className="text-sm text-muted-foreground ltr-num" dir="ltr">
                            {o.phone}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {o.city} · {o.product.name} · مقاس{" "}
                            <span className="ltr-num">{o.size}</span> ·{" "}
                            <b className="ltr-num">{Math.round(o.totalMad)} د.م</b>
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge status={o.status} />
                          <span className="text-xs text-muted-foreground ltr-num">
                            {o.attempts} محاولات
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        آخر محاولة: {fmtDateTime(o.lastAttemptAt)}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <WaButton
                          orderId={o.id}
                          templateKey={o.suggestedTemplateKey}
                          className="h-10"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 gap-1.5 border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/10"
                          disabled={busyId === o.id}
                          onClick={() => quickStatus(o, "confirmed")}
                        >
                          {busyId === o.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCheck className="h-4 w-4" />
                          )}
                          تأكيد
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10 gap-1.5 border-rose-600/40 text-rose-700 dark:text-rose-300 hover:bg-rose-600/10"
                          disabled={busyId === o.id}
                          onClick={() => quickStatus(o, "canceled")}
                        >
                          <XCircle className="h-4 w-4" />
                          إلغاء
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null
        )}
      </TabsContent>

      {/* ── Tab 2: double confirm ──────────────────────── */}
      <TabsContent value="double" className="space-y-3">
        {data.doubleConfirm.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              ماكاينش طلبات كتخرج غدا — دور غدا
            </CardContent>
          </Card>
        )}

        {data.doubleConfirm.map((o) => (
          <Card key={o.id} className="border-emerald-600/30">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold ltr-num">#{o.orderNumber}</span>
                  <span className="font-semibold ms-2">{o.customerName}</span>
                  <p className="text-sm text-muted-foreground ltr-num" dir="ltr">
                    {o.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {o.city} · {o.product.name} · مقاس{" "}
                    <span className="ltr-num">{o.size}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={o.status} />
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    يخرج غدا
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <WaButton
                  orderId={o.id}
                  templateKey="day_before"
                  className="h-10"
                  label="رسالة يوم قبل التوصيل"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 gap-1.5 border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/10"
                  disabled={busyId === o.id}
                  onClick={() => confirmedToday(o)}
                >
                  {busyId === o.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                  تأكد اليوم
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}
