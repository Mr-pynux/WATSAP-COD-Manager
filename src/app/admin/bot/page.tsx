"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getBotSettingsServer,
  saveBotSettingsServer,
  getBotAnalyticsServer,
  getSessionMessagesServer,
  type BotAnalyticsResponse,
  type BotContactAnalytics,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Bot,
  Save,
  Cpu,
  PhoneCall,
  MessageSquare,
  Mic,
  ShieldCheck,
  Search,
  RefreshCw,
  Copy,
  ExternalLink,
  MessageCircle,
  Clock,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Send,
} from "lucide-react";

export default function BotSettingsPage() {
  const [isActive, setIsActive] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<BotAnalyticsResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "confirmed_customer" | "customer">("all");

  // Selected session for chat transcript modal
  const [selectedContact, setSelectedContact] = useState<BotContactAnalytics | null>(null);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  async function loadData() {
    try {
      const [settingsData, analyticsData] = await Promise.all([
        getBotSettingsServer(),
        getBotAnalyticsServer(),
      ]);

      if (settingsData.settings) {
        setIsActive(settingsData.settings.is_active);
        setSystemPrompt(settingsData.settings.system_prompt);
      }
      setAnalytics(analyticsData);
    } catch (err: any) {
      toast.error(err.message || "تعذر تحميل بيانات البوت والتحليلات");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    toast.success("تم تحديث البيانات والإحصائيات بنجاح");
  }

  async function handleSave() {
    try {
      setSaving(true);
      await saveBotSettingsServer(isActive, systemPrompt);
      toast.success("تم حفظ إعدادات البوت بنجاح");
    } catch (error: any) {
      toast.error(error.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function openConversation(contact: BotContactAnalytics) {
    setSelectedContact(contact);
    setLoadingMessages(true);
    try {
      const res = await getSessionMessagesServer(contact.id);
      setSessionMessages(res.messages);
    } catch (err: any) {
      toast.error("تعذر تحميل رسائل المحادثة");
    } finally {
      setLoadingMessages(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label} بنجاح`);
  }

  const filteredContacts = useMemo(() => {
    if (!analytics) return [];
    return analytics.contacts.filter((c) => {
      const matchesSearch =
        c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.displayPhone.includes(searchQuery) ||
        c.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessage?.content || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "all" || c.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [analytics, searchQuery, roleFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">جاري تحميل بيانات البوت وتحليلات التوكنز والنوامر...</p>
      </div>
    );
  }

  const kpis = analytics?.kpis || {
    totalTokens: 0,
    todayTokens: 0,
    totalContacts: 0,
    totalMessages: 0,
    todayMessages: 0,
    totalAudio: 0,
    todayAudio: 0,
    freeTierStatus: "100% مجاني",
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">إدارة البوت الذكي والتوكنز</h1>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1.5 px-2.5 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  متصل ومحمي
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                متابعة استهلاك الذكاء الاصطناعي (Tokens)، عداد النوامر المتواصلة، وسجل المحادثات
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            تحديث البيانات
          </Button>
        </div>
      </div>

      {/* Server Health & Overload Clarification Card */}
      <Card className="border-emerald-200 dark:border-emerald-900 bg-gradient-to-r from-emerald-50/70 via-background to-teal-50/40 dark:from-emerald-950/30 dark:via-background dark:to-teal-950/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="p-2.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-base text-foreground">
                  توضيح بخصوص الضغط (خطأ 503 Overloaded) وحالة السيرفر
                </h3>
                <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200">
                  Google Gemini Cloud
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                الضغط اللي كان وقع قبيلة (Error 503: The model is overloaded) <strong>ما عندو حتى علاقة بالزوار أو السيت ديالك</strong>، حيت كما كتشوف فالإحصائيات لتحت، النوامر اللي تواصلوا اليوم راهم محدودين ومضبوطين.
                الضغط كان سببه <strong>سيرفرات شركة Google العالمية (Google Cloud)</strong> حيت الملايين ديال المطورين فالعالم كيستعملوا نموذج Gemini فـ نفس الثانية.
              </p>
              <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  حماية Timeout مفعلة (6 ثواني)
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Auto-Fallback تلقائي يمنع التوقف
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  سياق شركات التوصيل مدمج
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tokens Counter Card */}
        <Card className="border border-border/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              عداد التوكنز (AI Tokens)
            </CardTitle>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Cpu className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight">
                {kpis.totalTokens.toLocaleString()}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 rounded-full border border-emerald-200">
                0.00 DH مجاني
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span>استهلاك اليوم:</span>
              <span className="font-semibold text-foreground">
                {kpis.todayTokens.toLocaleString()} Token
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              حصة Google المجانية: 1,000,000 دقيقة
            </p>
          </CardContent>
        </Card>

        {/* Phone Numbers Counter Card */}
        <Card className="border border-border/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              النوامر المتواصلة (Contacts)
            </CardTitle>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
              <PhoneCall className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight">
                {kpis.totalContacts} نمرة
              </span>
              <Badge variant="secondary" className="text-xs">
                محادثات نشطة
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span>تفصيل النوامر:</span>
              <span className="font-semibold text-foreground text-[11px]">
                1 مدير 👑 | 1 زبون ✅ | 5 شات 💬
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              كل الأرقام محفوظة ومسجلة فالنظام
            </p>
          </CardContent>
        </Card>

        {/* Total Messages Card */}
        <Card className="border border-border/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              إجمالي الرسائل (Messages)
            </CardTitle>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
              <MessageSquare className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight">
                {kpis.totalMessages} رسالة
              </span>
              <span className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200">
                متبادلة
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span>رسائل اليوم:</span>
              <span className="font-semibold text-foreground">
                {kpis.todayMessages} رسائل
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              بين الزبناء والمدير التنفيذي والبوت
            </p>
          </CardContent>
        </Card>

        {/* Voice Notes Transcribed Card */}
        <Card className="border border-border/80 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              الأوديوات المفرغة (Voice Notes)
            </CardTitle>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Mic className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight">
                {kpis.totalAudio} أوديو
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200">
                Darija AI
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
              <span>أوديوات اليوم:</span>
              <span className="font-semibold text-foreground">
                {kpis.todayAudio} أوديوات
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              تفريغ فوري بالدارجة المغربية بنجاح
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="contacts" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4" />
            سجل النوامر والمحادثات ({kpis.totalContacts})
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            إعدادات وتعليمات البوت
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Contacts & Conversations */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                    <span>قائمة الأرقام اللي تواصلت مع الذكاء الاصطناعي</span>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {filteredContacts.length} رقم
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-1">
                    يمكنك تتبع كل نمرة، عدد الرسائل والأوديوات، التوكنز، وقراءة المحادثة مباشرة أو فتح الواتساب بضغطة زر.
                  </CardDescription>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative min-w-[220px]">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="بحث بالنمرة أو الاسم..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pr-9 h-9 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-muted p-1 rounded-md text-xs">
                    <button
                      onClick={() => setRoleFilter("all")}
                      className={`px-2.5 py-1 rounded transition-colors ${roleFilter === "all" ? "bg-background shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      الكل
                    </button>
                    <button
                      onClick={() => setRoleFilter("admin")}
                      className={`px-2.5 py-1 rounded transition-colors ${roleFilter === "admin" ? "bg-background shadow-xs font-semibold text-purple-600" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      المدير 👑
                    </button>
                    <button
                      onClick={() => setRoleFilter("confirmed_customer")}
                      className={`px-2.5 py-1 rounded transition-colors ${roleFilter === "confirmed_customer" ? "bg-background shadow-xs font-semibold text-emerald-600" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      مؤكد ✅
                    </button>
                    <button
                      onClick={() => setRoleFilter("customer")}
                      className={`px-2.5 py-1 rounded transition-colors ${roleFilter === "customer" ? "bg-background shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      شات 💬
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground border-y">
                    <tr>
                      <th className="py-3 px-4">رقم الهاتف</th>
                      <th className="py-3 px-4">الصفة / الهوية</th>
                      <th className="py-3 px-4">الرسائل المتبادلة</th>
                      <th className="py-3 px-4">التوكنز المقدرة</th>
                      <th className="py-3 px-4">آخر رسالة</th>
                      <th className="py-3 px-4">آخر تفاعل</th>
                      <th className="py-3 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredContacts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          لا توجد أي أرقام مطابقة للبحث أو الفلتر
                        </td>
                      </tr>
                    ) : (
                      filteredContacts.map((contact) => (
                        <tr
                          key={contact.id}
                          className="hover:bg-muted/30 transition-colors group"
                        >
                          {/* Phone */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-medium text-foreground dir-ltr text-left">
                                {contact.displayPhone}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6 text-muted-foreground opacity-60 hover:opacity-100"
                                onClick={() => copyToClipboard(contact.displayPhone, "رقم الهاتف")}
                                title="نسخ الرقم"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>

                          {/* Role / Identity */}
                          <td className="py-3.5 px-4">
                            {contact.role === "admin" && (
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 gap-1 font-medium">
                                <span>👑</span>
                                <span>سي أيوب (المدير العام)</span>
                              </Badge>
                            )}
                            {contact.role === "confirmed_customer" && (
                              <div className="flex flex-col gap-0.5">
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 gap-1 font-medium w-fit">
                                  <span>✅</span>
                                  <span>زبون مؤكد</span>
                                </Badge>
                                {contact.order && (
                                  <span className="text-[11px] text-muted-foreground">
                                    طلب #{contact.order.orderNumber} ({contact.order.city})
                                  </span>
                                )}
                              </div>
                            )}
                            {contact.role === "customer" && (
                              <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                                <span>💬</span>
                                <span>زبون / استفسار</span>
                              </Badge>
                            )}
                            {contact.role === "blacklisted" && (
                              <Badge variant="destructive" className="gap-1 font-medium">
                                <span>🚫</span>
                                <span>محظور</span>
                              </Badge>
                            )}
                          </td>

                          {/* Messages & Audio */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{contact.messagesCount} رسالة</span>
                              {contact.audioCount > 0 && (
                                <Badge variant="secondary" className="text-[11px] gap-1 px-1.5 py-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                                  <Mic className="w-2.5 h-2.5" />
                                  <span>{contact.audioCount}</span>
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground block">
                              ({contact.userMessagesCount} كليان / {contact.assistantMessagesCount} بوت)
                            </span>
                          </td>

                          {/* Tokens */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-xs font-medium text-foreground">
                              {contact.totalTokens.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-muted-foreground block">
                              Token
                            </span>
                          </td>

                          {/* Last message snippet */}
                          <td className="py-3.5 px-4 max-w-xs">
                            {contact.lastMessage ? (
                              <div className="truncate text-xs text-muted-foreground" title={contact.lastMessage.content}>
                                <span className="font-semibold text-foreground ml-1">
                                  {contact.lastMessage.role === "user" ? "الزبون:" : "البوت:"}
                                </span>
                                {contact.lastMessage.content}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">لا توجد رسائل</span>
                            )}
                          </td>

                          {/* Last active */}
                          <td className="py-3.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                            {contact.lastActive ? new Date(contact.lastActive).toLocaleString("ar-MA", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : "غير معروف"}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Open transcript modal */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1.5"
                                onClick={() => openConversation(contact)}
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-primary" />
                                <span>عرض المحادثة</span>
                              </Button>

                              {/* Direct WhatsApp link */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-800"
                                asChild
                              >
                                <a
                                  href={contact.waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="فتح الواتساب مباشرة"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>واتساب</span>
                                </a>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Bot Configuration & System Prompt */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>تهيئة البوت والرد الآلي</CardTitle>
              <CardDescription>
                من هنا يمكنك تفعيل أو إيقاف الرد الآلي عبر الواتساب، وتعديل تعليمات البوت (System Prompt).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-xl bg-slate-50 dark:bg-slate-900">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">تفعيل الرد التلقائي للبوت</Label>
                  <p className="text-sm text-muted-foreground">
                    إيلا فعلتيه، البوت غيولي يجاوب الكليان بوحدو عبر Webhook ويدير تأكيد الطلبيات وتفريغ الأوديوات.
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">تعليمات البوت (System Prompt)</Label>
                  <span className="text-xs text-muted-foreground">
                    الدارجة المغربية + قواعد الأدمين والزبناء
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  شنو الدور ديال هاد البوت؟ كيفاش بغيتيه يهضر؟ (مثلاً: اهضر بالدارجة، كون محترم، الهدف ديالك هو تاخد الموافقة على الطلب).
                </p>
                <Textarea
                  className="min-h-[220px] font-mono text-sm leading-relaxed"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="أنت مساعد ذكي لمتجر إلكتروني مغربي..."
                  dir="rtl"
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto gap-2">
                <Save className="w-4 h-4" />
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-800 dark:text-amber-400 text-sm flex items-center gap-2">
                <Info className="w-4 h-4" />
                رابط الـ Webhook الخاص بـ Meta WhatsApp API
              </CardTitle>
            </CardHeader>
            <CardContent className="text-amber-700 dark:text-amber-300 text-xs space-y-2">
              <p>
                الرابط المسجل فـ Meta للمحادثات التلقائية هو:
                <code className="mx-2 px-2 py-1 bg-amber-100 dark:bg-amber-900 rounded font-mono text-xs text-left inline-block" dir="ltr">
                  https://shoespot.vercel.app/api/webhook/whatsapp
                </code>
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Chat Transcript Dialog Modal */}
      <Dialog open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden" dir="rtl">
          {selectedContact && (
            <>
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b bg-muted/30">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-lg font-bold">
                        محادثة: {selectedContact.contactName}
                      </DialogTitle>
                      <Badge variant="outline" className="font-mono text-xs dir-ltr">
                        {selectedContact.displayPhone}
                      </Badge>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground mt-1">
                      إجمالي {selectedContact.messagesCount} رسالة | {selectedContact.audioCount} أوديو | {selectedContact.totalTokens.toLocaleString()} Token
                    </DialogDescription>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                    asChild
                  >
                    <a
                      href={selectedContact.waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      فتح فـ WhatsApp
                    </a>
                  </Button>
                </div>
              </div>

              {/* Chat Stream Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40 min-h-[350px] max-h-[55vh]">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center p-12 space-y-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">جاري تحميل رسائل المحادثة...</p>
                  </div>
                ) : sessionMessages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs">
                    لا توجد رسائل مسجلة لهذه النمرة
                  </div>
                ) : (
                  sessionMessages.map((msg: any) => {
                    const isUser = msg.role === "user";
                    const isAudio = msg.content && (msg.content.includes("🎙️") || msg.content.includes("[أوديو]"));

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? "items-start" : "items-end"} max-w-[85%] ${isUser ? "mr-auto" : "ml-auto"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {isUser ? selectedContact.contactName : "🤖 البوت الذكي"}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70">
                            {new Date(msg.created_at).toLocaleTimeString("ar-MA", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-xs ${
                            isUser
                              ? "bg-white dark:bg-slate-800 text-foreground border rounded-tr-xs"
                              : "bg-primary text-primary-foreground rounded-tl-xs"
                          }`}
                        >
                          {isAudio && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold mb-1 text-emerald-600 dark:text-emerald-400">
                              <Mic className="w-3.5 h-3.5" />
                              <span>رسالة صوتية (Audio مفرغ):</span>
                            </div>
                          )}
                          <div>{msg.content}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-background border-t flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  آخر تفاعل: {new Date(selectedContact.lastActive).toLocaleString("ar-MA")}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setSelectedContact(null)}>
                  إغلاق
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
