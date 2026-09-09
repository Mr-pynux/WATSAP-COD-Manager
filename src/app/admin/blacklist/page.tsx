"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, Info, Loader2, Plus, Trash2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { fmtDate } from "@/lib/format";
import { RETURN_REASON_LABELS, type ReturnReason } from "@/lib/constants";
import type { BlacklistEntryDTO } from "@/lib/types";

function reasonLabel(raw: string): string {
  if (raw in RETURN_REASON_LABELS) return RETURN_REASON_LABELS[raw as ReturnReason];
  return raw;
}

export default function BlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntryDTO[] | null>(null);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/blacklist");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { entries: BlacklistEntryDTO[] };
      setEntries(data.entries);
    } catch {
      toast.error("تعذر تحميل البلاك ليست");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addEntry() {
    setAdding(true);
    try {
      const res = await fetch("/api/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, reason: reason || undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "رقم غير صالح");
        return;
      }
      toast.success("تزاد الرقم للبلاك ليست");
      setPhone("");
      setReason("");
      await load();
    } catch {
      toast.error("تعذر الإضافة");
    } finally {
      setAdding(false);
    }
  }

  async function removeEntry(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/blacklist/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("تحيد من البلاك ليست");
      await load();
    } catch {
      toast.error("تعذر الحذف");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* info alert */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">
            القاعدة الأوتوماتيكية: ملي كيولّي الطلب{" "}
            <b>مرجع</b> ولا <b>ملغى</b>، كيتحسبو الطلبات بنفس الرقم — إلى وصلو{" "}
            <b>2 مخالفات</b> كيتزاد الرقم أوتوماتيكيا للبلاك ليست. الطلبات الجديدة من
            رقم فالبلاك ليست كتبقى كتقبل، ولكن كيبان ليك تنبيه أحمر فجدول الطلبات.
          </p>
        </CardContent>
      </Card>

      {/* manual add */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">إضافة يدوية</CardTitle>
          <CardDescription>زيد رقم مباشرة للبلاك ليست مع السبب</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="bl-phone">رقم الهاتف</Label>
            <Input
              id="bl-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06XXXXXXXX"
              dir="ltr"
              inputMode="numeric"
              className="text-left ltr-num"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bl-reason">السبب</Label>
            <Input
              id="bl-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثلا: طلبة 3 مرات وماجاش يتسلم"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={addEntry}
              disabled={adding || phone.trim().length < 9}
              className="h-10 gap-1.5 w-full sm:w-auto"
            >
              {adding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              زيد
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* table */}
      {entries === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            البلاك ليست خاوية — ماكاينش مخالفات
          </CardContent>
        </Card>
      ) : (
        <>
          {/* desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الهاتف</TableHead>
                    <TableHead>المخالفات</TableHead>
                    <TableHead>الأسباب</TableHead>
                    <TableHead>تاريخ الإضافة</TableHead>
                    <TableHead className="text-end">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell dir="ltr" className="ltr-num text-left font-semibold">
                        {e.phone}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 font-bold text-rose-600 ltr-num">
                          <Ban className="h-3.5 w-3.5" />
                          {e.strikes}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.reasons.map(reasonLabel).join(" · ")}
                      </TableCell>
                      <TableCell className="ltr-num">{fmtDate(e.createdAt)}</TableCell>
                      <TableCell className="text-end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 text-destructive"
                              aria-label={`حذف ${e.phone}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>حذف من البلاك ليست؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                الرقم <span className="ltr-num">{e.phone}</span> غادي يرجع
                                يقبل الطلبات بلا تنبيه.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeEntry(e.id)}
                                disabled={deleting === e.id}
                              >
                                {deleting === e.id && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                حذف
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* mobile cards */}
          <div className="md:hidden space-y-3">
            {entries.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold ltr-num" dir="ltr">
                      {e.phone}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-rose-600 ltr-num">
                      <Ban className="h-3.5 w-3.5" />
                      {e.strikes} مخالفات
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {e.reasons.map(reasonLabel).join(" · ")}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground ltr-num">
                      {fmtDate(e.createdAt)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-destructive gap-1"
                      onClick={() => removeEntry(e.id)}
                      disabled={deleting === e.id}
                    >
                      {deleting === e.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      حذف
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
