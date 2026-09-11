"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCheck,
  TrendingUp,
  Coins,
  Wallet,
  PiggyBank,
  PhoneCall,
  ArrowLeft,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { fmtDate, fmtMad, fmtPercent } from "@/lib/format";
import type { KpisResponse } from "@/lib/types";
import { getKpisServer } from "./actions";

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState<KpisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getKpisServer()
      .then((data) => setKpis(data))
      .catch((err) => setError("تعذر تحميل الإحصائيات"));
  }, []);

  if (error) {
    return <p className="text-destructive text-center py-10">{error}</p>;
  }

  if (!kpis) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const cards = [
    {
      title: "طلبات اليوم",
      value: String(kpis.ordersToday),
      icon: CalendarDays,
      hint: "كل الطلبات المسجلة اليوم",
    },
    {
      title: "نسبة التأكيد 30 يوم",
      value: fmtPercent(kpis.confirmationRate30d),
      icon: CheckCheck,
      hint: "(مؤكد + مرسل + موصل) ÷ (المجموع ماعدا الجديد)",
    },
    {
      title: "نسبة التوصيل",
      value: fmtPercent(kpis.deliveredRate30d),
      icon: TrendingUp,
      hint: "الموصل ÷ (الموصل + المرجع)",
    },
    {
      title: "تكلفة الطلب الموصل",
      value: kpis.costPerDelivered30d != null ? fmtMad(kpis.costPerDelivered30d) : "—",
      icon: Coins,
      hint: "مصاريف الإعلانات ÷ عدد الطلبات الموصلة",
    },
    {
      title: "المدخول 30 يوم",
      value: fmtMad(kpis.revenue30d),
      icon: Wallet,
      hint: "مجموع الطلبات الموصلة",
    },
    {
      title: "الربح الصافي 30 يوم",
      value: fmtMad(kpis.netProfit30d),
      icon: PiggyBank,
      hint: "المدخول − ثمن الشراء − التوصيل − الإعلانات",
      tone: kpis.netProfit30d >= 0 ? "good" : "bad",
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                {c.title}
              </CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p
                className={
                  "text-2xl font-extrabold " +
                  (c.tone === "good"
                    ? "text-emerald-600"
                    : c.tone === "bad"
                      ? "text-rose-600"
                      : "")
                }
              >
                {c.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* followup highlight */}
      <Link href="/admin/followup" className="block">
        <Card className="border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 transition-colors">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/15 text-orange-600 rounded-xl p-2.5">
                <PhoneCall className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold">طلبات فالمتابعة</p>
                <p className="text-sm text-muted-foreground">
                  مجاوبش / إعادة المحاولة — خاصو متابعة دابا
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-extrabold text-orange-600 ltr-num">
                {kpis.followupCount}
              </span>
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* latest orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="font-bold">آخر الطلبات</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/orders">
              جميع الطلبات
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {kpis.latestOrders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-6 py-3">
                <span className="font-bold ltr-num text-sm text-muted-foreground min-w-16">
                  #{o.orderNumber}
                </span>
                <span className="font-semibold truncate flex-1">{o.customerName}</span>
                <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-32">
                  {o.city}
                </span>
                <span className="text-sm font-bold ltr-num min-w-20 text-end">
                  {Math.round(o.totalMad)} د.م
                </span>
                <StatusBadge status={o.status} />
              </li>
            ))}
            {kpis.latestOrders.length === 0 && (
              <li className="px-6 py-8 text-center text-muted-foreground">
                مازال ماكاينش طلبات
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
