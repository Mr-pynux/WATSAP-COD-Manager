"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, Coins, Loader2, Megaphone, PiggyBank, Plus, Wallet } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PnlResponse } from "./actions";
import { getFinancePnlServer, getAdSpendServer, saveAdSpendServer } from "./actions";
import { fmtMad, fmtPercent } from "@/lib/format";

interface AdSpendEntry {
  date: string;
  amountMad: number;
}

function money(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

export default function FinancePage() {
  const [adspends, setAdspends] = useState<AdSpendEntry[] | null>(null);
  const [pnl, setPnl] = useState<PnlResponse | null>(null);

  const [spendDate, setSpendDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [spendAmount, setSpendAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [adRes, pnlRes] = await Promise.all([
        getAdSpendServer(),
        getFinancePnlServer(),
      ]);
      setAdspends(adRes.entries);
      setPnl(pnlRes);
    } catch {
      toast.error("تعذر تحميل المالية");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSpend() {
    const amount = Number(spendAmount);
    if (!spendDate || Number.isNaN(amount) || amount < 0) {
      toast.error("دخل تاريخ ومبلغ صحيحين");
      return;
    }
    setSaving(true);
    try {
      await saveAdSpendServer(spendDate, amount);
      toast.success("تسجل المبلغ");
      setSpendAmount("");
      await load();
    } catch {
      toast.error("تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: ad spend ─────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" />
            مصاريف الإعلانات
          </CardTitle>
          <CardDescription>
            سجل مصروف اليوم أو بدّلو — كيتحدّث أوتوماتيكيا (upsert)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="spend-date">التاريخ</Label>
              <Input
                id="spend-date"
                type="date"
                value={spendDate}
                onChange={(e) => setSpendDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="spend-amount">المبلغ (درهم)</Label>
              <Input
                id="spend-amount"
                value={spendAmount}
                onChange={(e) => setSpendAmount(e.target.value)}
                inputMode="decimal"
                placeholder="150"
                dir="ltr"
                className="text-left ltr-num"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={saveSpend} disabled={saving} className="w-full h-10 gap-1.5 sm:w-auto">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                سجل
              </Button>
            </div>
          </div>

          {adspends === null ? (
            <Skeleton className="h-32 rounded-xl" />
          ) : (
            <div className="max-h-48 overflow-y-auto nice-scroll rounded-xl border divide-y">
              {adspends.map((e) => (
                <div key={e.date} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span className="ltr-num">{e.date}</span>
                  </span>
                  <span className="font-semibold ltr-num">
                    {money(e.amountMad)} د.م
                  </span>
                </div>
              ))}
              {adspends.length === 0 && (
                <p className="px-4 py-8 text-center text-muted-foreground text-sm">
                  مازال ماكاينش مصاريف مسجلين
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: P&L per product ──────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الربح والخسارة (30 يوم)</CardTitle>
          <CardDescription>
            توزيع مصاريف الإعلانات: مجموع الإعلانات × (طلبات المنتج ÷ مجموع الطلبات)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pnl === null ? (
            <div className="p-6">
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden md:block overflow-x-auto nice-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>موصل</TableHead>
                      <TableHead>مرجع</TableHead>
                      <TableHead>المدخول</TableHead>
                      <TableHead>ثمن الشراء</TableHead>
                      <TableHead>التوصيل</TableHead>
                      <TableHead>الإعلانات</TableHead>
                      <TableHead>الصافي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pnl.products.map((p) => (
                      <TableRow key={p.productId}>
                        <TableCell className="font-semibold">{p.productName}</TableCell>
                        <TableCell className="ltr-num">{p.deliveredCount}</TableCell>
                        <TableCell className="ltr-num">{p.returnedCount}</TableCell>
                        <TableCell className="ltr-num">{money(p.revenueMad)}</TableCell>
                        <TableCell className="ltr-num text-muted-foreground">
                          {money(p.productCostMad)}
                        </TableCell>
                        <TableCell className="ltr-num text-muted-foreground">
                          {money(p.courierFeesMad)}
                        </TableCell>
                        <TableCell className="ltr-num text-muted-foreground">
                          {money(p.adSpendMad)}
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            ({fmtPercent(p.ordersShare)})
                          </span>
                        </TableCell>
                        <TableCell
                          className={
                            "font-bold ltr-num " +
                            (p.netMad >= 0 ? "text-emerald-600" : "text-rose-600")
                          }
                        >
                          {money(p.netMad)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">المجموع</TableCell>
                      <TableCell colSpan={2} />
                      <TableCell className="font-bold ltr-num">
                        {money(pnl.summary.revenueMad)}
                      </TableCell>
                      <TableCell className="ltr-num">
                        {money(pnl.summary.productCostMad)}
                      </TableCell>
                      <TableCell className="ltr-num">
                        {money(pnl.summary.courierFeesMad)}
                      </TableCell>
                      <TableCell className="ltr-num">{money(pnl.adSpend30d)}</TableCell>
                      <TableCell
                        className={
                          "font-bold ltr-num " +
                          (pnl.summary.netMad >= 0 ? "text-emerald-600" : "text-rose-600")
                        }
                      >
                        {money(pnl.summary.netMad)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>

              {/* mobile cards */}
              <div className="md:hidden divide-y">
                {pnl.products.map((p) => (
                  <div key={p.productId} className="p-4 space-y-2">
                    <p className="font-bold">{p.productName}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">
                        موصل: <b className="ltr-num">{p.deliveredCount}</b>
                      </span>
                      <span className="text-muted-foreground">
                        مرجع: <b className="ltr-num">{p.returnedCount}</b>
                      </span>
                      <span className="text-muted-foreground">
                        المدخول: <b className="ltr-num">{money(p.revenueMad)} د.م</b>
                      </span>
                      <span className="text-muted-foreground">
                        الشراء: <b className="ltr-num">{money(p.productCostMad)} د.م</b>
                      </span>
                      <span className="text-muted-foreground">
                        التوصيل: <b className="ltr-num">{money(p.courierFeesMad)} د.م</b>
                      </span>
                      <span className="text-muted-foreground">
                        الإعلانات: <b className="ltr-num">{money(p.adSpendMad)} د.م</b>
                      </span>
                    </div>
                    <p
                      className={
                        "font-bold ltr-num " +
                        (p.netMad >= 0 ? "text-emerald-600" : "text-rose-600")
                      }
                    >
                      الصافي: {money(p.netMad)} د.م
                    </p>
                  </div>
                ))}
              </div>

              <p className="px-4 py-3 text-xs text-muted-foreground">
                الصيغة: مصاريف الإعلانات ديال المنتج = {money(pnl.adSpend30d)} × (طلبات
                المنتج ÷ {pnl.totalOrders30d} طلب)
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: summary KPIs ─────────────────── */}
      {pnl && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                المدخول
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-extrabold">{fmtMad(pnl.summary.revenueMad)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                المصاريف الكلية
              </CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-extrabold">{fmtMad(pnl.summary.totalCostsMad)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                شراء + توصيل + إعلانات
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                الربح الصافي
              </CardTitle>
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p
                className={
                  "text-2xl font-extrabold ltr-num " +
                  (pnl.summary.netMad >= 0 ? "text-emerald-600" : "text-rose-600")
                }
              >
                {fmtMad(pnl.summary.netMad)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
