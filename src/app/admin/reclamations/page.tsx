"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageCircle,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  AlertCircle,
  FileText,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate } from "@/lib/format";
import type { ReclamationDTO, ReclamationStatus, ReclamationType } from "@/lib/types";
import {
  getReclamationsServer,
  updateReclamationStatusServer,
  deleteReclamationServer,
  createManualReclamationServer,
} from "./actions";

const TYPE_CONFIG: Record<
  ReclamationType,
  { label: string; badgeClass: string }
> = {
  exchange: {
    label: "🔄 تبديل مقاس",
    badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  },
  return: {
    label: "↩️ استرجاع",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  delivery_delay: {
    label: "🚚 تأخر التوصيل",
    badgeClass: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  },
  product_defect: {
    label: "⚠️ عيب في السلعة",
    badgeClass: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
  },
  cancellation: {
    label: "❌ إلغاء الطلب",
    badgeClass: "bg-stone-500/10 text-stone-600 border-stone-500/20 dark:text-stone-400",
  },
  other: {
    label: "💬 شكاية / أخرى",
    badgeClass: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
  },
};

const STATUS_CONFIG: Record<
  ReclamationStatus,
  { label: string; badgeClass: string; icon: any }
> = {
  pending: {
    label: "قيد الانتظار (لم يتم الاتصال)",
    badgeClass: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300 font-semibold",
    icon: Clock,
  },
  contacted: {
    label: "تم الاتصال (جاري المتابعة)",
    badgeClass: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300 font-medium",
    icon: PhoneCall,
  },
  resolved: {
    label: "تم الحل بنجاح",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300 font-medium",
    icon: CheckCircle2,
  },
  dismissed: {
    label: "ملغاة",
    badgeClass: "bg-stone-500/10 text-stone-600 border-stone-500/20 dark:text-stone-400",
    icon: AlertTriangle,
  },
};

export default function ReclamationsPage() {
  const [loading, setLoading] = useState(true);
  const [reclamations, setReclamations] = useState<ReclamationDTO[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, contacted: 0, resolved: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // New reclamation dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newType, setNewType] = useState<ReclamationType>("exchange");
  const [newIssue, setNewIssue] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // Selected for edit notes
  const [activeNotesItem, setActiveNotesItem] = useState<ReclamationDTO | null>(null);
  const [editingNotes, setEditingNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchReclamations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getReclamationsServer({
        status: statusFilter,
        query: searchQuery,
      });
      setReclamations(res.reclamations);
      setCounts(res.counts);
    } catch (e: any) {
      toast.error(e.message || "تعذر تحميل الشكايات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchReclamations();
  }, [fetchReclamations]);

  const handleStatusChange = async (id: string, newStatus: ReclamationStatus) => {
    try {
      await updateReclamationStatusServer(id, newStatus);
      toast.success("تم تحديث حالة الشكاية بنجاح");
      setReclamations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      // Refresh counts in background
      getReclamationsServer({ status: statusFilter, query: searchQuery }).then((res) => {
        setCounts(res.counts);
      });
    } catch (e: any) {
      toast.error(e.message || "تعذر تحديث الحالة");
    }
  };

  const handleSaveNotes = async () => {
    if (!activeNotesItem) return;
    try {
      setSavingNotes(true);
      await updateReclamationStatusServer(activeNotesItem.id, activeNotesItem.status, editingNotes);
      toast.success("تم حفظ الملاحظات بنجاح");
      setReclamations((prev) =>
        prev.map((r) => (r.id === activeNotesItem.id ? { ...r, adminNotes: editingNotes } : r))
      );
      setActiveNotesItem(null);
    } catch (e: any) {
      toast.error(e.message || "تعذر حفظ الملاحظات");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الشكاية؟")) return;
    try {
      await deleteReclamationServer(id);
      toast.success("تم حذف الشكاية بنجاح");
      setReclamations((prev) => prev.filter((r) => r.id !== id));
      setCounts((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch (e: any) {
      toast.error(e.message || "تعذر حذف الشكاية");
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustPhone.trim() || !newIssue.trim()) {
      toast.error("يرجى إدخال رقم الهاتف وتفاصيل الشكاية");
      return;
    }

    try {
      setSavingNew(true);
      await createManualReclamationServer({
        customerName: newCustName || "زبون",
        phone: newCustPhone,
        type: newType,
        issue: newIssue,
        adminNotes: newNotes,
      });
      toast.success("تمت إضافة الشكاية بنجاح");
      setDialogOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewIssue("");
      setNewNotes("");
      fetchReclamations();
    } catch (e: any) {
      toast.error(e.message || "تعذر إضافة الشكاية");
    } finally {
      setSavingNew(false);
    }
  };

  const formatWaLink = (phone: string, name: string) => {
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("0")) clean = "212" + clean.slice(1);
    const text = encodeURIComponent(
      `سلام أخويا ${name} 👋 كيتواصل معاك مسؤول متجر Shoespot بخصوص الشكاية ديالك...`
    );
    return `https://wa.me/${clean}?text=${text}`;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>إدارة الشكايات والتبديل (Réclamations)</span>
            {counts.pending > 0 && (
              <Badge className="bg-rose-500 text-white hover:bg-rose-600 animate-pulse text-xs">
                {counts.pending} في الانتظار
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            متابعة شكايات الزبائن وطلبات التبديل والاسترجاع المسجلة عبر البوت، والاتصال بهم لحل المشكل فوراً.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              fetchReclamations();
            }}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            تحديث
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" />
                إضافة شكاية يدوية
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="sm:max-w-[480px]">
              <form onSubmit={handleCreateManual}>
                <DialogHeader>
                  <DialogTitle>تسجيل شكاية زبون جديدة</DialogTitle>
                  <DialogDescription>
                    أدخل معلومات الزبون ونوع الشكاية وتفاصيل المشكل لمتابعتها هاتفياً.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="custName">اسم الزبون</Label>
                      <Input
                        id="custName"
                        placeholder="مثال: يونس العلمي"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="custPhone">رقم الهاتف *</Label>
                      <Input
                        id="custPhone"
                        placeholder="06XXXXXXXX"
                        dir="ltr"
                        required
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="typeSelect">نوع الشكاية</Label>
                    <Select
                      value={newType}
                      onValueChange={(v) => setNewType(v as ReclamationType)}
                    >
                      <SelectTrigger id="typeSelect">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_CONFIG).map(([tKey, conf]) => (
                          <SelectItem key={tKey} value={tKey}>
                            {conf.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="issueDesc">تفاصيل الشكاية / المشكل *</Label>
                    <Textarea
                      id="issueDesc"
                      rows={3}
                      placeholder="اشرح المشكل الذي يعاني منه الزبون (المقاس لا يناسبه، تأخر الطلب...)"
                      required
                      value={newIssue}
                      onChange={(e) => setNewIssue(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes">ملاحظات الإدارة (اختياري)</Label>
                    <Input
                      id="notes"
                      placeholder="مثال: وعدناه بالاتصال بعد الزوال..."
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={savingNew}>
                    {savingNew ? "جاري الحفظ..." : "حفظ الشكاية"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border/60 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">إجمالي الشكايات</p>
              <h3 className="text-2xl font-bold mt-1">{counts.total}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-rose-500/30 bg-rose-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                في الانتظار (لم يتم الاتصال)
              </p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {counts.pending}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-rose-500/15 text-rose-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-blue-500/30 bg-blue-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                تم الاتصال (جاري المتابعة)
              </p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {counts.contacted}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-500/15 text-blue-600 flex items-center justify-center">
              <PhoneCall className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                تم الحل بنجاح
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {counts.resolved}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card className="border border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث برقم الهاتف، الاسم، أو المشكل..."
                className="pr-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="text-xs h-8"
              >
                الكل ({counts.total})
              </Button>
              <Button
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("pending")}
                className={`text-xs h-8 ${
                  statusFilter === "pending" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""
                }`}
              >
                في الانتظار ({counts.pending})
              </Button>
              <Button
                variant={statusFilter === "contacted" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("contacted")}
                className={`text-xs h-8 ${
                  statusFilter === "contacted" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                }`}
              >
                تم الاتصال ({counts.contacted})
              </Button>
              <Button
                variant={statusFilter === "resolved" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("resolved")}
                className={`text-xs h-8 ${
                  statusFilter === "resolved" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                }`}
              >
                تم الحل ({counts.resolved})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reclamations Table */}
      <Card className="border border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[140px] text-right">التاريخ والوقت</TableHead>
                <TableHead className="w-[180px] text-right">الزبون والهاتف</TableHead>
                <TableHead className="w-[140px] text-right">نوع الشكاية</TableHead>
                <TableHead className="text-right">تفاصيل المشكل</TableHead>
                <TableHead className="w-[200px] text-right">حالة المعالجة</TableHead>
                <TableHead className="w-[140px] text-right">ملاحظات الإدارة</TableHead>
                <TableHead className="w-[80px] text-center">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    جاري تحميل الشكايات...
                  </TableCell>
                </TableRow>
              ) : reclamations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    لا توجد أي شكايات مطابقة حالياً.
                  </TableCell>
                </TableRow>
              ) : (
                reclamations.map((rec) => {
                  const typeConf = TYPE_CONFIG[rec.type] || TYPE_CONFIG.other;
                  const statusConf = STATUS_CONFIG[rec.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConf.icon;

                  return (
                    <TableRow key={rec.id} className="hover:bg-muted/30 transition-colors">
                      {/* Date */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(rec.createdAt)}
                      </TableCell>

                      {/* Customer & Call Actions */}
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {rec.customerName}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                            {rec.phone}
                          </span>

                          {/* Action Buttons: Direct Call & WhatsApp */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <a
                              href={`tel:${rec.phone}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20 transition-colors"
                              title="اتصال هاتفي مباشر"
                            >
                              <Phone className="h-3 w-3" />
                              اتصال
                            </a>

                            <a
                              href={formatWaLink(rec.phone, rec.customerName)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/20 dark:text-emerald-400 border border-emerald-600/20 transition-colors"
                              title="محادثة واتساب"
                            >
                              <MessageCircle className="h-3 w-3" />
                              واتساب
                            </a>
                          </div>
                        </div>
                      </TableCell>

                      {/* Type Badge */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs px-2.5 py-0.5 whitespace-nowrap border ${typeConf.badgeClass}`}
                        >
                          {typeConf.label}
                        </Badge>
                      </TableCell>

                      {/* Issue Description */}
                      <TableCell>
                        <p className="text-sm text-foreground leading-relaxed max-w-md break-words">
                          {rec.issue}
                        </p>
                      </TableCell>

                      {/* Status Dropdown */}
                      <TableCell>
                        <div className="space-y-1">
                          <Select
                            value={rec.status}
                            onValueChange={(val) =>
                              handleStatusChange(rec.id, val as ReclamationStatus)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs border border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent dir="rtl">
                              {Object.entries(STATUS_CONFIG).map(([sKey, sConf]) => (
                                <SelectItem key={sKey} value={sKey} className="text-xs">
                                  {sConf.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>

                      {/* Admin Notes */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveNotesItem(rec);
                            setEditingNotes(rec.adminNotes || "");
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted text-right block w-full truncate max-w-[120px]"
                        >
                          {rec.adminNotes ? rec.adminNotes : "إضافة ملاحظة..."}
                        </button>
                      </TableCell>

                      {/* Delete Action */}
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rec.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Notes Dialog */}
      <Dialog
        open={!!activeNotesItem}
        onOpenChange={(open) => !open && setActiveNotesItem(null)}
      >
        <DialogContent dir="rtl" className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>ملاحظات الشكاية</DialogTitle>
            <DialogDescription>
              سجل أي تفاصيل تم الاتفاق عليها مع الزبون {activeNotesItem?.customerName}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            <Textarea
              rows={4}
              placeholder="اكتب الملاحظات هنا..."
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveNotesItem(null)}
            >
              إلغاء
            </Button>
            <Button onClick={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? "جاري الحفظ..." : "حفظ الملاحظة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
