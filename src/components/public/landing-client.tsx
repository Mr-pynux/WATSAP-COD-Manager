"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Banknote,
  Truck,
  RefreshCw,
  Star,
  CheckCircle2,
  XCircle,
  Minus,
  Plus,
  Ruler,
  Loader2,
  ShieldCheck,
  ArrowDown,
  ShoppingBag,
  BadgePercent,
  Check,
  Maximize2,
  Play,
  RotateCw,
  ArrowRight,
  UserCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOROCCAN_CITIES } from "@/lib/constants";
import { MA_PHONE_REGEX } from "@/lib/phone";
import { orderDiscount, orderTotal } from "@/lib/pricing";
import { Product3DViewer } from "@/components/public/product-3d-viewer";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZE_CHART: { eu: string; cm: string }[] = [
  { eu: "39", cm: "24.5" },
  { eu: "40", cm: "25.0" },
  { eu: "41", cm: "25.7" },
  { eu: "42", cm: "26.0" },
  { eu: "43", cm: "26.7" },
  { eu: "44", cm: "27.3" },
  { eu: "45", cm: "28.0" },
];

const formSchema = z.object({
  name: z.string().trim().min(3, "الاسم قصير — كتب الاسم الكامل"),
  phone: z
    .string()
    .trim()
    .refine((v) => MA_PHONE_REGEX.test(v), "رقم الهاتف خاصو يكون 06 ولا 07 + 8 أرقام"),
  city: z.string().trim().min(2, "المرجو كتابة اسم المدينة"),
  district: z.string().optional(),
  landmark: z.string().optional(),
  paymentMethod: z.enum(["cod", "paypal", "rib"]).default("cod"),
});

type FormData = z.infer<typeof formSchema>;

interface LandingClientProps {
  product: ProductDTO;
  onBack?: () => void;
}

const FALLBACK_DESCRIPTION =
  "سنيكرز خفيف ومريح، صالح للاستعمال اليومي — والتوصيل فابور لجميع المدن، وكتخلص فقط ملي توصلك السلعة لباب دارك.";

export function LandingClient({ product, onBack }: LandingClientProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [size, setSize] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [sizeTouched, setSizeTouched] = useState(false);
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);

  // Landing page is always light
  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", phone: "", city: "", district: "", landmark: "", paymentMethod: "cod" },
  });

  const phoneValue = watch("phone") ?? "";
  const phoneState = useMemo(() => {
    if (!phoneValue) return "empty" as const;
    return MA_PHONE_REGEX.test(phoneValue) ? ("valid" as const) : ("invalid" as const);
  }, [phoneValue]);

  const images = product.imageUrls;
  const description = product.description || FALLBACK_DESCRIPTION;
  const regularTotal = product.priceMad * quantity;
  const discountMad = orderDiscount(quantity, product);
  const baseTotal = orderTotal(quantity, product.priceMad, discountMad);
  const paymentMethod = watch("paymentMethod") || "cod";
  const total = paymentMethod !== "cod" ? baseTotal - 10 : baseTotal;
  const hasOffer = !!product.offerQty && !!product.offerTotalMad;
  const oldDiscount = product.oldPriceMad
    ? Math.round((1 - product.priceMad / product.oldPriceMad) * 100)
    : 0;

  const availableSizes = useMemo(() => {
    const allPossibleSizes = ["39", "40", "41", "42", "43", "44", "45"];
    return allPossibleSizes.filter((s) => {
      if (!product.stockBySize) return false;
      const stockVal = String(product.stockBySize[s] || "").trim().toLowerCase();
      return stockVal !== "" && stockVal !== "0" && stockVal !== "-";
    });
  }, [product.stockBySize]);

  function scrollToForm() {
    document.getElementById("order-form")?.scrollIntoView({ behavior: "smooth" });
  }

  async function onSubmit(values: FormData) {
    if (!size) {
      setSizeTouched(true);
      toast.error("اختر المقاس أولا");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id || undefined,
          name: values.name,
          phone: values.phone,
          city: values.city,
          district: values.district || null,
          landmark: values.landmark || null,
          size,
          quantity,
          paymentMethod: values.paymentMethod,
        }),
      });
      const data = (await res.json()) as { orderNumber?: number; error?: string };
      if (!res.ok || !data.orderNumber) {
        toast.error(data.error || "وقع مشكل، عاود المحاولة");
        return;
      }
      // Meta Pixel purchase event (only injected when pixel id is set)
      const w = window as unknown as { fbq?: (...args: unknown[]) => void };
      w.fbq?.("track", "Purchase", { value: total, currency: "MAD" });
      router.push(`/success?n=${data.orderNumber}`);
    } catch {
      toast.error("تعذر الاتصال بالسيرفر، تحقق من الأنترنيت");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white text-stone-900 min-h-screen pb-24 md:pb-0">
      {/* ── 1. Slim header ─────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="h-9 w-9 text-stone-600 hover:text-stone-950"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
            )}
            <span className="bg-stone-950 rounded-xl px-2 py-1.5 flex items-center shrink-0">
              <Image
                src="/logo.png"
                alt="ShoeSpot"
                width={96}
                height={66}
                priority
                className="h-9 w-auto"
              />
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="hidden sm:inline-flex bg-stone-950 text-brand border-stone-950 hover:bg-stone-950">
              <Banknote className="h-3.5 w-3.5" />
              الدفع عند الاستلام
            </Badge>
            <a 
              href="/admin" 
              aria-label="لوحة التحكم"
              className="flex items-center justify-center h-9 w-9 text-stone-600 hover:text-stone-950 hover:bg-stone-100 rounded-md transition-colors"
            >
              <UserCircle className="h-6 w-6" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        {/* ── 2. Hero + 3D viewer ─────────────────────── */}
        <section className="pt-8 md:pt-14 pb-8 grid md:grid-cols-2 gap-8 items-center">
          <div className="order-2 md:order-1 space-y-5">
            <div className="inline-flex items-center gap-1.5 bg-brand-soft text-stone-900 border border-brand/50 rounded-full px-3 py-1 text-sm font-semibold">
              <Star className="h-4 w-4 fill-brand-strong text-brand-strong" />
              4.8 <span className="text-stone-500 font-normal">| +1200 طلب</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-4xl font-extrabold text-stone-950 ltr-num">
                {Math.round(product.priceMad)}{" "}
                <span className="text-2xl">درهم</span>
              </span>
              {hasOffer && (
                <Badge className="bg-stone-950 text-brand border-stone-950 hover:bg-stone-950 text-sm whitespace-nowrap">
                  <BadgePercent className="h-3.5 w-3.5" />
                  عرض خاص: {product.offerQty === 2 ? "زوج" : product.offerQty} بـ
                  {Math.round(product.offerTotalMad ?? 0)} درهم
                </Badge>
              )}
              {product.oldPriceMad && (
                <>
                  <span className="text-xl text-stone-400 line-through ltr-num">
                    {Math.round(product.oldPriceMad)} درهم
                  </span>
                  <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100 text-sm">
                    <BadgePercent className="h-3.5 w-3.5" />−{oldDiscount}%
                  </Badge>
                </>
              )}
            </div>

            <p className="text-stone-600 text-lg leading-relaxed">{description}</p>

            {product.features.length > 0 && (
              <ul className="space-y-2">
                {product.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-stone-800">
                    <span className="bg-brand rounded-full p-1 shrink-0">
                      <Check className="h-3.5 w-3.5 text-stone-950" strokeWidth={3} />
                    </span>
                    <span className="font-semibold">{f}</span>
                  </li>
                ))}
              </ul>
            )}

            <Button
              size="lg"
              onClick={scrollToForm}
              className="w-full md:w-auto h-14 text-lg font-extrabold gap-2 shadow-lg shadow-brand/30"
            >
              <ShoppingBag className="h-5 w-5" />
              اطلب دابا — الدفع عند الاستلام
            </Button>
          </div>

          <div className="order-1 md:order-2 min-w-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="min-w-0"
            >
              <Product3DViewer
                name={product.name}
                images={images}
                videoUrl={product.videoUrl}
                openIndex={inspectIndex}
                onOpenIndexChange={setInspectIndex}
              />
            </motion.div>
          </div>
        </section>

        {/* ── 3. Benefits row ─────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6">
          {[
            {
              icon: Banknote,
              title: "الدفع عند الاستلام",
              text: "كتخلص فقط ملي توصلك السلعة",
            },
            {
              icon: Truck,
              title: "التوصيل فابور",
              text: "لجميع المدن المغربية — 24-48 ساعة",
            },
            {
              icon: RefreshCw,
              title: "تبديل مجاني",
              text: "المقاس ماجاكش؟ نبدلوهولك بلا فلوس",
            },
          ].map((b) => (
            <Card key={b.title} className="border-stone-200 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="bg-stone-950 text-brand rounded-xl p-3 shrink-0">
                  <b.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">{b.title}</p>
                  <p className="text-sm text-stone-500">{b.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* ── 4. Product configurator ─────────────────── */}
        <section className="py-6">
          <Card className="border-stone-200 shadow-sm">
            <CardContent className="p-5 md:p-8 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-lg">
                    المقاس{" "}
                    {sizeTouched && !size && (
                      <span className="text-rose-600 text-sm font-normal">
                        — المقاس مطلوب
                      </span>
                    )}
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-9">
                        <Ruler className="h-4 w-4" />
                        جدول المقاسات
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>جدول المقاسات</DialogTitle>
                        <DialogDescription>
                          قيس طول الرجل بسم وختار المقاس المناسب
                        </DialogDescription>
                      </DialogHeader>
                      <table className="w-full text-center border-collapse">
                        <thead>
                          <tr className="bg-stone-100">
                            <th className="p-2 font-bold rounded-r-md">المقاس EU</th>
                            <th className="p-2 font-bold rounded-l-md">الطول (سم)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SIZE_CHART.map((row) => (
                            <tr key={row.eu} className="border-b border-stone-100">
                              <td className="p-2 ltr-num font-semibold">{row.eu}</td>
                              <td className="p-2 ltr-num">{row.cm}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.length === 0 ? (
                    <p className="text-sm text-rose-500 font-bold">المنتج غير متوفر حالياً بالمقاسات.</p>
                  ) : (
                    availableSizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSize(s);
                        setSizeTouched(true);
                      }}
                      aria-label={`اختر المقاس ${s}`}
                      aria-pressed={size === s}
                      className={cn(
                        "h-11 min-w-11 px-3 rounded-xl border-2 font-bold text-base transition-all",
                        size === s
                          ? "border-brand bg-brand/20 text-stone-950"
                          : "border-stone-200 text-stone-700 hover:border-stone-300"
                      )}
                    >
                      <span className="ltr-num">{s}</span>
                    </button>
                  )))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-bold text-lg">الكمية</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="نقص الكمية"
                    className="h-11 w-11 rounded-xl border-2 border-stone-200 flex items-center justify-center hover:border-stone-300"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="ltr-num text-xl font-bold w-8 text-center">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(3, q + 1))}
                    aria-label="زد الكمية"
                    className="h-11 w-11 rounded-xl border-2 border-stone-200 flex items-center justify-center hover:border-stone-300"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-stone-500">
                    {hasOffer
                      ? `الوحدة ${Math.round(product.priceMad)} درهم — ${
                          product.offerQty === 2 ? "زوج" : product.offerQty
                        } بـ${Math.round(product.offerTotalMad ?? 0)} درهم`
                      : "(الحد الأقصى 3 فالطلب الواحد)"}
                  </span>
                </div>
              </div>

              <Button
                size="lg"
                onClick={scrollToForm}
                variant="secondary"
                className="w-full h-12 font-bold gap-2"
              >
                كمّل الطلب
                <ArrowDown className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* ── 5. Order form ───────────────────────────── */}
        <section id="order-form" className="py-6 scroll-mt-20">
          <Card className="border-2 border-brand/40 shadow-lg shadow-brand/10">
            <CardContent className="p-5 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-stone-950 text-brand rounded-full p-2">
                  <Banknote className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold">أكد الطلب ديالك</h2>
                  <p className="text-stone-500 text-sm">
                    عمّر المعلومات وغانعيطو ليك للتأكيد قبل الإرسال
                  </p>
                </div>
              </div>

              {/* live order summary */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm space-y-1.5">
                <p className="font-bold text-base mb-2">ملخص الطلب</p>
                <div className="flex justify-between">
                  <span className="text-stone-500">المنتج</span>
                  <span className="font-semibold">{product.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">المقاس</span>
                  <span className="font-semibold ltr-num">{size || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">الكمية</span>
                  <span className="font-semibold ltr-num">{quantity}</span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-2 mt-2 text-base">
                  <span className="font-bold">المجموع</span>
                  <span className="font-extrabold text-stone-950 ltr-num flex items-center gap-2">
                    {discountMad > 0 && (
                      <span className="text-sm font-normal text-stone-400 line-through ltr-num">
                        {Math.round(regularTotal)} درهم
                      </span>
                    )}
                    {Math.round(total)} درهم
                  </span>
                </div>
                {discountMad > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-900 text-sm font-semibold">
                      وفّرت {Math.round(discountMad)} درهم مع عرض الزوج
                    </span>
                    <span className="text-stone-400 text-sm">تخفيض إضافي</span>
                  </div>
                )}
                {paymentMethod !== "cod" && (
                  <div className="flex justify-between text-green-600 font-semibold text-sm">
                    <span>خصم الدفع المسبق ({paymentMethod === "paypal" ? "PayPal" : "تحويل بنكي"})</span>
                    <span className="ltr-num">-10 درهم</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="name">الاسم الكامل *</Label>
                    <Input
                      id="name"
                      placeholder="مثلا: يوسف العلمي"
                      autoComplete="name"
                      className="h-12"
                      aria-invalid={!!errors.name}
                      {...register("name")}
                    />
                    {errors.name && (
                      <p className="text-sm text-rose-600">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف *</Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder="06XXXXXXXX"
                        dir="ltr"
                        className={cn(
                          "h-12 text-left ltr-num",
                          phoneState === "valid" && "border-brand-strong focus-visible:ring-brand/30",
                          phoneState === "invalid" && "border-rose-400 focus-visible:ring-rose-500/30"
                        )}
                        aria-invalid={!!errors.phone || phoneState === "invalid"}
                        {...register("phone")}
                      />
                      {phoneState === "valid" && (
                        <CheckCircle2 className="absolute end-3 top-1/2 -translate-y-1/2 h-5 w-5 text-brand-strong" />
                      )}
                      {phoneState === "invalid" && (
                        <XCircle className="absolute end-3 top-1/2 -translate-y-1/2 h-5 w-5 text-rose-500" />
                      )}
                    </div>
                    {phoneState === "invalid" && !errors.phone && (
                      <p className="text-sm text-rose-600">
                        {phoneValue.startsWith("0") || phoneValue.length < 10
                          ? "رقم ناقص — خاصو يكون 06 ولا 07 + 8 أرقام"
                          : "رقم غير صحيح — تحقق منو"}
                      </p>
                    )}
                    {errors.phone && (
                      <p className="text-sm text-rose-600">{errors.phone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">المدينة *</Label>
                    <Input
                      id="city"
                      placeholder="مثلا: الدار البيضاء"
                      className="h-12"
                      aria-invalid={!!errors.city}
                      {...register("city")}
                    />
                    {errors.city && (
                      <p className="text-sm text-rose-600">{errors.city.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="district">الحي (اختياري)</Label>
                    <Input
                      id="district"
                      placeholder="مثلا: حي المعاريف"
                      className="h-12"
                      {...register("district")}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="landmark">نقطة دالة قريبة (اختياري)</Label>
                    <Input
                      id="landmark"
                      placeholder="مثلا: قرب جامع، فرمة، مدرسة..."
                      className="h-12"
                      {...register("landmark")}
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label>طريقة الدفع *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setValue("paymentMethod", "cod", { shouldValidate: true })}
                        className={cn(
                          "p-4 rounded-xl border-2 text-center transition-all",
                          watch("paymentMethod") === "cod"
                            ? "border-brand bg-brand/10 text-stone-950"
                            : "border-stone-200 text-stone-600 hover:border-brand/50"
                        )}
                      >
                        <div className="font-bold text-lg">عند الاستلام</div>
                        <div className="text-xs text-stone-500 mt-1 font-semibold">
                          تخلص ملي توصلك السلعة
                        </div>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setValue("paymentMethod", "paypal", { shouldValidate: true })}
                        className={cn(
                          "p-4 rounded-xl border-2 text-center transition-all relative",
                          watch("paymentMethod") === "paypal"
                            ? "border-brand bg-brand/10 text-stone-950"
                            : "border-stone-200 text-stone-600 hover:border-brand/50"
                        )}
                      >
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand text-stone-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                          وفر 10 دراهم
                        </div>
                        <div className="font-bold text-lg">PayPal</div>
                        <div className="text-xs text-stone-500 mt-1 font-semibold">
                          دفع آمن ومسبق
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setValue("paymentMethod", "rib", { shouldValidate: true })}
                        className={cn(
                          "p-4 rounded-xl border-2 text-center transition-all relative",
                          watch("paymentMethod") === "rib"
                            ? "border-brand bg-brand/10 text-stone-950"
                            : "border-stone-200 text-stone-600 hover:border-brand/50"
                        )}
                      >
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand text-stone-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                          وفر 10 دراهم
                        </div>
                        <div className="font-bold text-lg">تحويل بنكي</div>
                        <div className="text-xs text-stone-500 mt-1 font-semibold">
                          Virement / RIB
                        </div>
                      </button>
                    </div>
                    {watch("paymentMethod") !== "cod" && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex items-start gap-2 text-sm mt-3">
                        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
                        <div>
                          <p className="font-bold">ضمان الدفع المسبق:</p>
                          <p className="leading-relaxed">يشمل خدمات التبديل وإرجاع المال داخل ظرف 48 ساعة في حال كان في الحذاء عيب ما.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="w-full h-14 text-lg font-extrabold gap-2 shadow-lg shadow-brand/30"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      كنسجلو الطلب...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-5 w-5" />
                      أكد الطلب — {Math.round(total)} درهم {watch("paymentMethod") === "cod" ? "عند الاستلام" : "مسبقاً"}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* ── 6. Trust strip (dark, logo-style) ───────── */}
        <section className="py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-950 rounded-2xl p-4 border border-stone-800">
            {[
              { icon: Banknote, text: "الدفع عند الاستلام" },
              { icon: RefreshCw, text: "تبديل مجاني للمقاس" },
              { icon: Truck, text: "التوصيل فابور" },
            ].map((t) => (
              <div key={t.text} className="flex items-center justify-center gap-2 py-2">
                <t.icon className="h-5 w-5 text-brand" />
                <span className="font-semibold text-white">{t.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. Gallery (opens 3D inspection) ────────── */}
        {(images.length > 1 || product.videoUrl) && (
          <section className="py-6 pb-10">
            <div className="flex items-center gap-2 mb-4">
              <RotateCw className="h-5 w-5 text-brand-strong" />
              <h2 className="text-2xl font-extrabold">شوف المنتج من جميع الجهات</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.slice(1).map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setInspectIndex(i + 1)}
                  aria-label={`فحص صورة ${i + 2} بحجم كبير`}
                  className="group relative aspect-square rounded-2xl overflow-hidden border border-stone-200 bg-stone-100 focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <img
                    src={src}
                    alt={`${product.name} — صورة ${i + 2}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute bottom-2 end-2 bg-stone-950/85 text-brand rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
              {product.videoUrl && (
                <button
                  type="button"
                  onClick={() => setInspectIndex(images.length)}
                  aria-label="شوف فيديو المنتج"
                  className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-brand/60 bg-stone-950 flex flex-col items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="bg-brand rounded-full p-3 group-hover:scale-110 transition-transform">
                    <Play className="h-6 w-6 text-stone-950 fill-stone-950" />
                  </span>
                  <span className="text-white font-bold text-sm">فيديو المنتج</span>
                </button>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ── 8. Footer ─────────────────────────────────── */}
      <footer className="bg-stone-950 border-t border-stone-800 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-3">
          <span className="inline-flex bg-stone-900 rounded-xl px-2 py-1.5">
            <Image src="/logo.png" alt="ShoeSpot" width={96} height={66} className="h-8 w-auto" />
          </span>
          <p className="text-stone-400 text-sm">
            © 2026 ShoeSpot — الدفع عند الاستلام فجميع المغرب
          </p>
          <Link
            href="/login"
            className="text-stone-500 text-xs hover:text-brand transition-colors"
          >
            دخول المسؤول
          </Link>
        </div>
      </footer>

      {/* ── 9. Sticky mobile CTA ──────────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-stone-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-col">
            {hasOffer ? (
              <>
                <span className="text-sm font-bold text-stone-900">
                  <span className="ltr-num">{Math.round(product.offerTotalMad ?? 0)} درهم</span>{" "}
                  {product.offerQty === 2 ? "للزوج" : `لـ${product.offerQty}`}
                </span>
                <span className="text-xs text-stone-400 ltr-num">
                  الوحدة {Math.round(product.priceMad)} درهم
                </span>
              </>
            ) : (
              <span className="text-xl font-extrabold text-stone-950 ltr-num">
                {Math.round(product.priceMad)} درهم
              </span>
            )}
          </div>
          <Button
            onClick={scrollToForm}
            className="h-12 px-6 text-base font-bold flex-1 max-w-64"
          >
            <ShoppingBag className="h-5 w-5" />
            اطلب دابا
          </Button>
        </div>
      </div>
    </div>
  );
}
