"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Truck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtPercent } from "@/lib/format";
import type { CourierStatsDTO } from "@/lib/types";

export default function CouriersPage() {
  const [couriers, setCouriers] = useState<CourierStatsDTO[] | null>(null);
  const [feeDrafts, setFeeDrafts] = useState<Record<string, { delivery: string; return: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // add form
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [feeDelivery, setFeeDelivery] = useState("");
  const [feeReturn, setFeeReturn] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/couriers");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { couriers: CourierStatsDTO[] };
      setCouriers(data.couriers);
      const drafts: Record<string, { delivery: string; return: string }> = {};
      for (const c of data.couriers) {
        drafts[c.id] = {
          delivery: String(c.feePerDeliveryMad),
          return: String(c.feePerReturnMad),
        };
      }
      setFeeDrafts(drafts);
    } catch {
      toast.error("تعذر تحميل الناقلين");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveFees(c: CourierStatsDTO) {
    const draft = feeDrafts[c.id];
    if (!draft) return;
    const delivery = Number(draft.delivery);
    const ret = Number(draft.return);
    if (Number.isNaN(delivery) || Number.isNaN(ret) || delivery < 0 || ret < 0) {
      toast.error("الأثمنة خاصهم يكونو أرقام صحيحة");
      return;
    }
    setSavingId(c.id);
    try {
      const res = await fetch(`/api/couriers/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feePerDeliveryMad: delivery, feePerReturnMad: ret }),
      });
      if (!res.ok) throw new Error();
      toast.success(`تسجلو أثمنة ${c.name}`);
      await load();
    } catch {
      toast.error("تعذر الحفظ");
    } finally {
      setSavingId(null);
    }
  }

  async function addCourier() {
    const delivery = Number(feeDelivery);
    const ret = Number(feeReturn);
    if (name.trim().length < 2 || Number.isNaN(delivery) || Number.isNaN(ret)) {
      toast.error("عمّر الاسم والأثمنة بشكل صحيح");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/couriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim() || null,
          feePerDeliveryMad: delivery,
          feePerReturnMad: ret,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("تزاد الناقل");
      setName("");
      setContact("");
      setFeeDelivery("");
      setFeeReturn("");
      await load();
    } catch {
      toast.error("تعذر إضافة الناقل");
    } finally {
      setAdding(false);
    }
  }

  function setDraft(id: string, key: "delivery" | "return", value: string) {
    setFeeDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  }

  return (
    <div className="space-y-4">
      {/* add courier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">زيد ناقل جديد</CardTitle>
          <CardDescription>شركة التوصيل + الأثمنة (درهم)</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">الاسم</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلا: Speed4Pro" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-contact">التواصل</Label>
            <Input id="c-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="05XX-XXXX" dir="ltr" className="text-left ltr-num" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-fee-d">ثمن التوصيل</Label>
            <Input id="c-fee-d" value={feeDelivery} onChange={(e) => setFeeDelivery(e.target.value)} inputMode="decimal" placeholder="25" dir="ltr" className="text-left ltr-num" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-fee-r">ثمن الإرجاع</Label>
            <Input id="c-fee-r" value={feeReturn} onChange={(e) => setFeeReturn(e.target.value)} inputMode="decimal" placeholder="12" dir="ltr" className="text-left ltr-num" />
          </div>
          <div className="flex items-end">
            <Button onClick={addCourier} disabled={adding} className="w-full h-10 gap-1.5">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              زيد
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* courier cards */}
      {couriers === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {couriers.map((c) => {
            const draft = feeDrafts[c.id];
            const changed =
              draft &&
              (Number(draft.delivery) !== c.feePerDeliveryMad ||
                Number(draft.return) !== c.feePerReturnMad);
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2 space-y-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Truck className="h-5 w-5 text-primary" />
                      {c.name}
                    </CardTitle>
                    {c.contact && (
                      <span className="text-sm text-muted-foreground ltr-num" dir="ltr">
                        {c.contact}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted rounded-xl p-2">
                      <p className="text-xs text-muted-foreground">موصل</p>
                      <p className="font-bold ltr-num">{c.deliveredCount}</p>
                    </div>
                    <div className="bg-muted rounded-xl p-2">
                      <p className="text-xs text-muted-foreground">مرجع</p>
                      <p className="font-bold ltr-num">{c.returnedCount}</p>
                    </div>
                    <div className="bg-muted rounded-xl p-2">
                      <p className="text-xs text-muted-foreground">نسبة الإرجاع</p>
                      <p className="font-bold ltr-num">{fmtPercent(c.returnRate)}</p>
                    </div>
                  </div>

                  {/* inline fees editor */}
                  {draft && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            ثمن التوصيل (د.م)
                          </Label>
                          <Input
                            value={draft.delivery}
                            onChange={(e) => setDraft(c.id, "delivery", e.target.value)}
                            inputMode="decimal"
                            dir="ltr"
                            className="h-9 text-left ltr-num"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            ثمن الإرجاع (د.م)
                          </Label>
                          <Input
                            value={draft.return}
                            onChange={(e) => setDraft(c.id, "return", e.target.value)}
                            inputMode="decimal"
                            dir="ltr"
                            className="h-9 text-left ltr-num"
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={changed ? "default" : "outline"}
                        className="w-full h-9 gap-1.5"
                        disabled={savingId === c.id || !changed}
                        onClick={() => saveFees(c)}
                      >
                        {savingId === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        حفظ الأثمنة
                      </Button>
                    </div>
                  )}

                  {c.returnRate != null && c.returnRate >= 0.3 && (
                    <Badge className="bg-rose-600/10 text-rose-700 dark:text-rose-300 border-rose-600/30 w-full justify-center">
                      نسبة الإرجاع مرتفعة
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
