"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Download,
  ExternalLink,
  FilterX,
  Loader2,
  MessageCircle,
  Moon,
  Package,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { WaButton } from "@/components/admin/wa-button";
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  MOROCCAN_CITIES,
  RETURN_REASONS,
  RETURN_REASON_LABELS,
  type OrderStatus,
  type ReturnReason,
} from "@/lib/constants";
import { fmtDate, toDateInput } from "@/lib/format";
import type { OrderDTO, OrdersResponse, BlacklistEntryDTO, CourierStatsDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getOrdersServer, getCouriersServer, getBlacklistServer, updateOrderStatusServer, bulkUpdateStatusServer, updateOrderDetailsServer, exportOrdersCSVServer, bulkDeleteOrdersServer, getPendingEveningDispatchCountServer, sendEveningDispatchServer } from "./actions";

interface Filters {
  status: string;
  city: string;
  courierId: string;
  phone: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  status: "all",
  city: "all",
  courierId: "all",
  phone: "",
  from: "",
  to: "",
};

function queryParams(f: Filters, page: number): string {
  const p = new URLSearchParams();
  if (f.status !== "all") p.set("status", f.status);
  if (f.city !== "all") p.set("city", f.city);
  if (f.courierId !== "all") p.set("courierId", f.courierId);
  if (f.phone.trim()) p.set("phone", f.phone.trim());
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  p.set("page", String(page));
  return p.toString();
}

export default function AdminOrdersPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [phoneInput, setPhoneInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<OrderDTO | null>(null);
  const [couriers, setCouriers] = useState<CourierStatsDTO[]>([]);
  const [strikesByPhone, setStrikesByPhone] = useState<Record<string, number>>({});
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [pendingDispatchCount, setPendingDispatchCount] = useState<number>(0);
  const [sendingDispatch, setSendingDispatch] = useState(false);
  const firstLoad = useRef(true);

  // debounced phone search
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.phone === phoneInput ? f : { ...f, phone: phoneInput }));
      setPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [phoneInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrdersServer(filters, page);
      setData(res);
      getPendingEveningDispatchCountServer()
        .then((c) => setPendingDispatchCount(c.count))
        .catch(() => {});
    } catch {
      toast.error("تعذر تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      getCouriersServer()
        .then((d) => setCouriers(d.couriers ?? []))
        .catch(() => {});
      getBlacklistServer()
        .then((d) => {
          const map: Record<string, number> = {};
          for (const e of d.entries ?? []) map[e.phone] = e.strikes;
          setStrikesByPhone(map);
        })
        .catch(() => {});
    }
  }, []);

  const orders = useMemo(() => data?.orders ?? [], [data]);

  function setFilter<K extends keyof Filters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  async function changeStatus(order: OrderDTO, status: string) {
    try {
      await updateOrderStatusServer(order.id, status);
      toast.success(`الطلب #${order.orderNumber} ولّى ${STATUS_LABELS[status as OrderStatus]}`);
      await load();
    } catch {
      toast.error("تعذر تغيير الحالة");
    }
  }

  async function applyBulk() {
    if (!bulkStatus || selected.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await bulkUpdateStatusServer(Array.from(selected), bulkStatus);
      toast.success(`تبدّلو ${res.changed} طلبات`);
      setSelected(new Set());
      setBulkStatus("");
      await load();
    } catch {
      toast.error("تعذر التحديث الجماعي");
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteBulk() {
    if (selected.size === 0) return;
    if (!confirm("واش متأكد بغيتي تحذف هاد الطلبات؟ (هاد العملية ما يمكنش تراجع عليها)")) return;
    setBulkBusy(true);
    try {
      const res = await bulkDeleteOrdersServer(Array.from(selected));
      toast.success(`تحذفو ${res.deleted} طلبات`);
      setSelected(new Set());
      await load();
    } catch {
      toast.error("تعذر حذف الطلبات");
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(orders.map((o) => o.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function exportCsv() {
    try {
      const exportIds = selected.size > 0 ? Array.from(selected) : undefined;
      const exportFilters = selected.size > 0 ? undefined : filters;
      
      const { csv } = await exportOrdersCSVServer(exportIds, exportFilters);
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `orders_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("تعذر تصدير الطلبات");
    }
  }

  async function handleEveningDispatch() {
    try {
      setSendingDispatch(true);
      const res = await sendEveningDispatchServer();
      if (res.success) {
        toast.success(res.message);
        load();
      } else {
        toast.error(res.message || "حدث خطأ أثناء الإرسال");
      }
    } catch (err: any) {
      toast.error(err.message || "تعذر إرسال إشعار الشحن");
    } finally {
      setSendingDispatch(false);
    }
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* ── Quick Status Filter Pills ────────────────── */}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        <Button
          variant={filters.status === "all" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs font-semibold"
          onClick={() => setFilter("status", "all")}
        >
          الكل
        </Button>
        <Button
          variant={filters.status === "confirmed_continuous" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs font-semibold bg-teal-600/10 text-teal-700 dark:text-teal-300 border-teal-600/30 hover:bg-teal-600/20"
          onClick={() => setFilter("status", "confirmed_continuous")}
        >
          مؤكدة مستمرة
        </Button>
        <Button
          variant={filters.status === "shipped" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs font-semibold"
          onClick={() => setFilter("status", "shipped")}
        >
          مرسل (فالطريق)
        </Button>
        <Button
          variant={filters.status === "delivered" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs font-semibold"
          onClick={() => setFilter("status", "delivered")}
        >
          تم التوصيل
        </Button>
        <Button
          variant={filters.status === "returned" ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs font-semibold"
          onClick={() => setFilter("status", "returned")}
        >
          الروتور (مرجع)
        </Button>
        <Button
          variant={filters.status === "scammer" ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-8 text-xs font-bold gap-1.5 transition-all",
            filters.status === "scammer"
              ? "bg-purple-700 text-white shadow-md shadow-purple-500/20 border-purple-600"
              : "bg-purple-950/20 text-purple-400 border-purple-500/40 hover:bg-purple-950/40"
          )}
          onClick={() => setFilter("status", "scammer")}
        >
          <span>🚫</span>
          <span>النصابة</span>
        </Button>
      </div>

      {/* ── Filters bar ─────────────────────────────── */}
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div className="space-y-1.5 xl:col-span-1">
            <Label className="text-xs text-muted-foreground">الحالة</Label>
            <Select value={filters.status} onValueChange={(v) => setFilter("status", v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">من تاريخ</Label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilter("from", e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">إلى تاريخ</Label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilter("to", e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">المدينة</Label>
            <Select value={filters.city} onValueChange={(v) => setFilter("city", v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent className="max-h-64 nice-scroll">
                <SelectItem value="all">كل المدن</SelectItem>
                {MOROCCAN_CITIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">الناقل</Label>
            <Select value={filters.courierId} onValueChange={(v) => setFilter("courierId", v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الناقلين</SelectItem>
                {couriers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">بحث بالهاتف</Label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="06..."
                dir="ltr"
                className="h-10 ps-9 text-left ltr-num"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="h-10 w-full gap-1.5"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPhoneInput("");
                setPage(1);
              }}
            >
              <FilterX className="h-4 w-4" />
              تصفير الفلاتر
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Bulk bar + export ───────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={exportCsv} variant="outline" className="gap-1.5 h-10">
          <Download className="h-4 w-4" />
          تصدير CSV {selected.size > 0 ? `(${selected.size})` : "(الفلاتر الحالية)"}
        </Button>

        <Button
          onClick={handleEveningDispatch}
          disabled={sendingDispatch}
          className="gap-2 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
        >
          {sendingDispatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Moon className="h-4 w-4" />}
          إرسال إشعار الشحن المسائي (8:00 PM)
          {pendingDispatchCount > 0 && (
            <Badge variant="secondary" className="bg-emerald-800 text-white px-2 py-0.5 text-xs font-bold">
              {pendingDispatchCount}
            </Badge>
          )}
        </Button>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-muted rounded-xl p-2 border flex-1">
            <span className="text-sm font-semibold px-1 ltr-num">
              مختارين: {selected.size}
            </span>
            <Select value={bulkStatus || undefined} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="الحالة الجديدة" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={applyBulk}
              disabled={!bulkStatus || bulkBusy}
              size="sm"
              className="h-9 gap-1.5"
            >
              {bulkBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              تطبيق على المختارين
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-9 gap-1.5"
              onClick={deleteBulk}
              disabled={bulkBusy}
            >
              حذف الطلبات
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => setSelected(new Set())}
            >
              إلغاء الاختيار
            </Button>
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            ماكاينش طلبات بهاد الفلاتر
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Desktop table ─────────────────────── */}
          <Card className="hidden lg:block overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto nice-scroll">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={orders.length > 0 && selected.size === orders.length}
                          onCheckedChange={(v) => toggleAll(v === true)}
                          aria-label="اختيار الكل"
                        />
                      </TableHead>
                      <TableHead>الرقم</TableHead>
                      <TableHead>الزبون</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>المدينة</TableHead>
                      <TableHead>المنتج</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>المحاولات</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead className="text-end">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => {
                      const blacklisted = strikesByPhone[o.phone] !== undefined;
                      return (
                        <TableRow key={o.id} className={cn(blacklisted && "bg-rose-500/5")}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(o.id)}
                              onCheckedChange={(v) => toggleOne(o.id, v === true)}
                              aria-label={`اختيار الطلب ${o.orderNumber}`}
                            />
                          </TableCell>
                          <TableCell>
                            <span className="font-bold ltr-num">
                              #{o.orderNumber}
                            </span>
                            {blacklisted && (
                              <div className="mt-1">
                                <Badge className="bg-rose-600/10 text-rose-700 dark:text-rose-300 border-rose-600/30 whitespace-normal">
                                  <AlertTriangle className="h-3 w-3" />
                                  فالبلاك ليست — {strikesByPhone[o.phone]} مخالفات
                                </Badge>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditing(o)}
                                className="font-semibold hover:text-primary text-start"
                              >
                                {o.customerName}
                              </button>
                              <a
                                href={`/admin/orders/${o.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-md hover:bg-muted"
                                title="فتح الطلب والصور في تبويب جديد (Autre onglet)"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                            {o.district && (
                              <p className="text-xs text-muted-foreground">{o.district}</p>
                            )}
                          </TableCell>
                          <TableCell dir="ltr" className="ltr-num text-left">
                            {o.phone}
                          </TableCell>
                          <TableCell>{o.city}</TableCell>
                          <TableCell>
                            {o.items && o.items.length > 1 ? (
                              <div className="space-y-1">
                                <Badge variant="secondary" className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30 text-[11px] font-bold">
                                  🎁 عرض {o.items.length} أحذية ({Math.round(o.totalMad)} د.م)
                                </Badge>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex -space-x-2 rtl:space-x-reverse overflow-hidden">
                                    {o.items.map((it, idx) => (
                                      <div key={idx} className="relative h-8 w-8 rounded-md overflow-hidden border-2 border-background shadow-xs shrink-0 bg-muted">
                                        {it.imageUrl ? (
                                          <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                                        ) : (
                                          <Package className="h-4 w-4 m-auto text-muted-foreground" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <div className="text-xs text-muted-foreground leading-tight">
                                    {o.items.map((it, idx) => (
                                      <span key={idx}>
                                        {it.name} (<span className="ltr-num font-semibold">{it.size}</span>)
                                        {idx < o.items!.length - 1 ? " + " : ""}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-md overflow-hidden border shrink-0 bg-muted flex items-center justify-center">
                                  {o.items?.[0]?.imageUrl || o.product.imageUrls?.[0] ? (
                                    <img
                                      src={o.items?.[0]?.imageUrl || o.product.imageUrls?.[0]}
                                      alt={o.product.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{o.product.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    مقاس <span className="ltr-num">{o.size}</span>
                                    {o.color ? ` / ${o.color}` : ""} / ×
                                    <span className="ltr-num">{o.quantity}</span>
                                  </p>
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-bold ltr-num whitespace-nowrap">
                            {Math.round(o.totalMad)} د.م
                          </TableCell>
                          <TableCell className="ltr-num">{o.attempts}</TableCell>
                          <TableCell className="ltr-num whitespace-nowrap">
                            {fmtDate(o.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={o.status}
                              onValueChange={(v) => changeStatus(o, v)}
                            >
                              <SelectTrigger className="h-8 w-28 border-0 p-0 shadow-none focus:ring-0 [&>svg]:hidden">
                                <StatusBadge status={o.status} />
                              </SelectTrigger>
                              <SelectContent>
                                {ORDER_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {STATUS_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              <WaButton orderId={o.id} size="icon" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setEditing(o)}
                                aria-label={`تفاصيل الطلب ${o.orderNumber}`}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ── Mobile card list ──────────────────── */}
          <div className="lg:hidden space-y-3">
            {orders.map((o) => {
              const blacklisted = strikesByPhone[o.phone] !== undefined;
              return (
                <Card key={o.id} className={cn(blacklisted && "border-rose-600/40")}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selected.has(o.id)}
                          onCheckedChange={(v) => toggleOne(o.id, v === true)}
                          aria-label={`اختيار الطلب ${o.orderNumber}`}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-bold ltr-num">#{o.orderNumber}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditing(o)}
                              className="font-semibold leading-tight text-start hover:text-primary"
                            >
                              {o.customerName}
                            </button>
                            <a
                              href={`/admin/orders/${o.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary p-0.5"
                              title="فتح في تبويب جديد"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                          <p className="text-sm text-muted-foreground ltr-num" dir="ltr">
                            {o.phone}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>

                    {blacklisted && (
                      <Badge className="bg-rose-600/10 text-rose-700 dark:text-rose-300 border-rose-600/30">
                        <AlertTriangle className="h-3 w-3" />
                        فالبلاك ليست — {strikesByPhone[o.phone]} مخالفات
                      </Badge>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {o.city} · <span className="ltr-num">{o.attempts}</span> محاولات ·{" "}
                        <span className="ltr-num">{fmtDate(o.createdAt)}</span>
                      </span>
                      <span className="font-bold ltr-num">
                        {Math.round(o.totalMad)} د.م
                      </span>
                    </div>

                    {o.items && o.items.length > 1 ? (
                      <div className="bg-muted/60 p-2.5 rounded-lg space-y-1.5 border border-muted">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30 text-xs font-bold">
                            🎁 عرض {o.items.length} أحذية
                          </Badge>
                          <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{Math.round(o.totalMad)} د.م</span>
                        </div>
                        <div className="space-y-1.5 pt-1">
                          {o.items.map((it, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <div className="h-8 w-8 rounded-md overflow-hidden border bg-background shrink-0 flex items-center justify-center">
                                {it.imageUrl ? (
                                  <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                                ) : (
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <span className="font-medium flex-1 truncate">{it.name}</span>
                              <Badge variant="outline" className="text-[11px] px-1.5 py-0 h-5">
                                مقاس <span className="ltr-num ms-1 font-bold">{it.size}</span>
                              </Badge>
                              {it.color && <span className="text-muted-foreground">({it.color})</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                        <div className="h-8 w-8 rounded-md overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
                          {o.items?.[0]?.imageUrl || o.product.imageUrls?.[0] ? (
                            <img
                              src={o.items?.[0]?.imageUrl || o.product.imageUrls?.[0]}
                              alt={o.product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <span>
                          {o.product.name} — مقاس <span className="ltr-num">{o.size}</span>
                          {o.color ? ` / ${o.color}` : ""}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Select value={o.status} onValueChange={(v) => changeStatus(o, v)}>
                        <SelectTrigger className="h-10 flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORDER_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <WaButton orderId={o.id} className="h-10" />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => setEditing(o)}
                        aria-label={`تفاصيل الطلب ${o.orderNumber}`}
                      >
                        <MessageCircle className="h-4 w-4 rotate-90" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Pagination ────────────────────────── */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground ltr-num">
              {(data?.total ?? 0)} طلب — صفحة {page} من {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="gap-1"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="gap-1"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Edit sheet ───────────────────────────────── */}
      <EditOrderSheet
        order={editing}
        couriers={couriers}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </div>
  );
}

/* ══════════════════════ Edit sheet ══════════════════════ */

function EditOrderSheet({
  order,
  couriers,
  onClose,
  onSaved,
}: {
  order: OrderDTO | null;
  couriers: CourierStatsDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [courierId, setCourierId] = useState("");
  const [tracking, setTracking] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [notes, setNotes] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setCourierId(order.courierId ?? "");
      setTracking(order.tracking ?? "");
      setShipDate(toDateInput(order.shipDate));
      setNotes(order.notes ?? "");
      setReturnReason(order.returnReason ?? "");
      setStatus(order.status);
    }
  }, [order]);

  async function save() {
    if (!order) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        courierId: courierId || null,
        tracking: tracking || null,
        shipDate: shipDate || null,
        notes: notes || null,
      };
      if (status !== order.status) body.status = status;
      if (status === "returned") body.returnReason = returnReason || null;

      await updateOrderDetailsServer(order.id, body);
      toast.success("تسجل التغيير");
      onSaved();
    } catch {
      toast.error("تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!order} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="start" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto nice-scroll">
        {order && (
          <>
            <SheetHeader className="pb-2 border-b">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SheetTitle className="text-lg sm:text-xl">
                  الطلب <span className="ltr-num">#{order.orderNumber}</span> —{" "}
                  {order.customerName}
                </SheetTitle>
                <a
                  href={`/admin/orders/${order.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  فتح في صفحة كاملة (تبويب جديد)
                </a>
              </div>
              <SheetDescription className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span>
                  {order.city}
                  {order.district ? ` / ${order.district}` : ""}
                  {order.landmark ? ` / ${order.landmark}` : ""} ·{" "}
                  <span className="ltr-num font-bold text-foreground" dir="ltr">
                    {order.phone}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <a href={`tel:${order.phone}`}>
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-semibold">
                      اتصال 📞
                    </Button>
                  </a>
                  <a
                    href={`https://wa.me/${order.phone.startsWith("0") ? "212" + order.phone.slice(1) : order.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                      واتساب 💬
                    </Button>
                  </a>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-8">
              {/* Product items gallery with photos */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  المنتجات المطلوبة ({order.items?.length || 1})
                </Label>
                <div className="space-y-2">
                  {(order.items && order.items.length > 0 ? order.items : [
                    {
                      productId: order.productId,
                      name: order.product.name,
                      size: order.size,
                      color: order.color,
                      quantity: order.quantity,
                      priceMad: order.unitPriceMad,
                      imageUrl: order.product.imageUrls?.[0] || null,
                    }
                  ]).map((it, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-muted/70 p-3 rounded-xl border border-muted">
                      <div className="h-16 w-16 rounded-lg overflow-hidden border bg-background shrink-0 shadow-xs flex items-center justify-center">
                        {it.imageUrl ? (
                          <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-bold text-sm leading-tight truncate">{it.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-background text-xs font-semibold px-2 py-0.5">
                            المقاس: <span className="ltr-num ms-1 font-bold text-primary">{it.size}</span>
                          </Badge>
                          {it.color && (
                            <Badge variant="outline" className="bg-background text-xs px-2 py-0.5">
                              اللون: <span className="ms-1">{it.color}</span>
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ltr-num">
                            ×{it.quantity}
                          </span>
                        </div>
                      </div>
                      <div className="text-end font-bold text-sm ltr-num text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {Math.round((it.priceMad || order.unitPriceMad) * (it.quantity || 1))} د.م
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm bg-muted rounded-xl p-3 border">
                <div>
                  المبلغ الإجمالي:{" "}
                  <b className="ltr-num text-emerald-600 dark:text-emerald-400 text-base">
                    {Math.round(order.totalMad)} د.م
                  </b>
                </div>
                <div>
                  المحاولات: <b className="ltr-num">{order.attempts}</b>
                </div>
                <div>
                  التسجيل: <b className="ltr-num">{fmtDate(order.createdAt)}</b>
                </div>
                <div>
                  آخر محاولة:{" "}
                  <b className="ltr-num">{fmtDate(order.lastAttemptAt)}</b>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {status === "returned" && (
                <div className="space-y-1.5">
                  <Label>سبب الإرجاع</Label>
                  <Select value={returnReason || undefined} onValueChange={setReturnReason}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="اختر السبب" />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {RETURN_REASON_LABELS[r as ReturnReason]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>الناقل</Label>
                <Select value={courierId || "none"} onValueChange={(v) => setCourierId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="بلا ناقل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بلا ناقل</SelectItem>
                    {couriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tracking">رقم التتبع</Label>
                <Input
                  id="tracking"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  dir="ltr"
                  className="text-left ltr-num"
                  placeholder="TRK..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="shipdate">تاريخ الإرسال</Label>
                <Input
                  id="shipdate"
                  type="date"
                  value={shipDate}
                  onChange={(e) => setShipDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="ملاحظات على الطلب..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={save} disabled={saving} className="flex-1 h-11 gap-1.5">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  حفظ التغييرات
                </Button>
                <WaButton orderId={order.id} className="h-11 flex-1" label="واتساب" />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
