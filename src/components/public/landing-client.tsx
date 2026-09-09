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
  city: z.string().min(1, "اختر المدينة"),
  district: z.string().optional(),
  landmark: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface LandingClientProps {
  product: ProductDTO;
}

export function LandingClient({ product }: LandingClientProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [color, setColor] = useState<string>(product.colors[0]?.name ?? "");
  const [size, setSize] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [sizeTouched, setSizeTouched] = useState(false);

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
    defaultValues: { name: "", phone: "", city: "", district: "", landmark: "" },
  });

  const phoneValue = watch("phone") ?? "";
  const phoneState = useMemo(() => {
    if (!phoneValue) return "empty" as const;
    return MA_PHONE_REGEX.test(phoneValue) ? ("valid" as const) : ("invalid" as const);
  }, [phoneValue]);

  const images = product.imageUrls.length ? product.imageUrls : [];
  const heroImage = images[0] ?? "";
  const gallery = images.slice(1, 6);
  const regularTotal = product.priceMad * quantity;
  const discountMad = orderDiscount(quantity, product);
  const total = orderTotal(quantity, product.priceMad, discountMad);
  const hasOffer = !!product.offerQty && !!product.offerTotalMad;
  const oldDiscount = product.oldPriceMad
    ? Math.round((1 - product.priceMad / product.oldPriceMad) * 100)
    : 0;

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
          color: color || null,
          quantity,
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

  const selectedColorHex = product.colors.find((c) => c.name === color)?.hex;

  return (
    <div className="bg-white text-stone-900 min-h-screen pb-24 md:pb-0">
      {/* ── 1. Slim header ─────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="bg-stone-900 rounded-xl px-2 py-1.5 flex items-center shrink-0">
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
          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
            <Banknote className="h-3.5 w-3.5" />
            الدفع عند الاستلام
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        {/* ── 2. Hero ─────────────────────────────────── */}
        <section className="pt-8 md:pt-14 pb-8 grid md:grid-cols-2 gap-8 items-center">
          <div className="order-2 md:order-1 space-y-5">
            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 text-sm font-semibold">
              <Star className="h-4 w-4 fill-emerald-600 text-emerald-600" />
              4.8 <span className="text-stone-500 font-normal">| +1200 طلب</span>
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-4xl font-extrabold text-emerald-600">
                {Math.round(product.priceMad)} درهم
              </span>
              {hasOffer && (
                <Badge className="bg-stone-900 text-yellow-300 border-stone-900 hover:bg-stone-900 text-sm whitespace-nowrap">
                  <BadgePercent className="h-3.5 w-3.5" />
                  عرض خاص: {product.offerQty === 2 ? "زوج" : product.offerQty} بـ
                  {Math.round(product.offerTotalMad ?? 0)} درهم
                </Badge>
              )}
              {product.oldPriceMad && (
                <>
                  <span className="text-xl text-stone-400 line-through">
                    {Math.round(product.oldPriceMad)} درهم
                  </span>
                  <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100 text-sm">
                    <BadgePercent className="h-3.5 w-3.5" />−{oldDiscount}%
                  </Badge>
                </>
              )}
            </div>

            <p className="text-stone-600 text-lg leading-relaxed">
              سنيكرز خفيف ومريح، صالح للاستعمال اليومي — والتوصيل فابور لجميع
              المدن، وكتخلص فقط ملي توصلك السلعة لباب دارك.
            </p>

            <Button
              size="lg"
              onClick={scrollToForm}
              className="w-full md:w-auto h-14 text-lg font-bold gap-2 shadow-lg shadow-emerald-600/20"
            >
              <ShoppingBag className="h-5 w-5" />
              اطلب دابا — الدفع عند الاستلام
            </Button>
          </div>

          <div className="order-1 md:order-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="relative rounded-3xl overflow-hidden border border-stone-200 shadow-xl bg-stone-50"
            >
              {heroImage && (
                <Image
                  src={heroImage}
                  alt={`${product.name} — الصورة الرئيسية`}
                  width={1200}
                  height={900}
                  priority
                  className="w-full h-auto object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              )}
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
                <div className="bg-emerald-50 text-emerald-600 rounded-xl p-3 shrink-0">
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
                <p className="font-bold text-lg">
                  اللون <span className="text-stone-500 font-normal text-sm">({color})</span>
                </p>
                <div className="flex gap-3">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setColor(c.name)}
                      aria-label={`اختر اللون ${c.name}`}
                      aria-pressed={color === c.name}
                      className={cn(
                        "h-11 w-11 rounded-full border-2 flex items-center justify-center transition-all",
                        color === c.name
                          ? "border-emerald-600 ring-2 ring-emerald-200 scale-110"
                          : "border-stone-200 hover:border-stone-300"
                      )}
                      style={{ backgroundColor: c.hex }}
                    >
                      {color === c.name && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-700 mix-blend-difference" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

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
                  {product.sizes.map((s) => (
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
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                          : "border-stone-200 text-stone-700 hover:border-stone-300"
                      )}
                    >
                      <span className="ltr-num">{s}</span>
                    </button>
                  ))}
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
          <Card className="border-2 border-emerald-100 shadow-lg shadow-emerald-600/5">
            <CardContent className="p-5 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600 text-white rounded-full p-2">
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
                  <span className="text-stone-500">اللون</span>
                  <span className="font-semibold">
                    {color || "—"}
                    {selectedColorHex && (
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full border border-stone-300 ms-2 align-middle"
                        style={{ backgroundColor: selectedColorHex }}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">الكمية</span>
                  <span className="font-semibold ltr-num">{quantity}</span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-2 mt-2 text-base">
                  <span className="font-bold">المجموع</span>
                  <span className="font-extrabold text-emerald-600 ltr-num flex items-center gap-2">
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
                    <span className="text-emerald-700 text-sm font-semibold">
                      وفّرت {Math.round(discountMad)} درهم مع عرض الزوج
                    </span>
                    <span className="text-stone-400 text-sm">الدفع عند الاستلام</span>
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
                          phoneState === "valid" && "border-emerald-500 focus-visible:ring-emerald-500/30",
                          phoneState === "invalid" && "border-rose-400 focus-visible:ring-rose-500/30"
                        )}
                        aria-invalid={!!errors.phone || phoneState === "invalid"}
                        {...register("phone")}
                      />
                      {phoneState === "valid" && (
                        <CheckCircle2 className="absolute end-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
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
                    <Select
                      value={watch("city")}
                      onValueChange={(v) => setValue("city", v, { shouldValidate: true })}
                    >
                      <SelectTrigger id="city" className="h-12">
                        <SelectValue placeholder="اختر المدينة" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {MOROCCAN_CITIES.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="w-full h-14 text-lg font-extrabold gap-2 shadow-lg shadow-emerald-600/25"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      كنسجلو الطلب...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-5 w-5" />
                      أكد الطلب — {Math.round(total)} درهم عند الاستلام
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* ── 6. Trust strip ──────────────────────────── */}
        <section className="py-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 border border-stone-200 rounded-2xl p-4">
            {[
              { icon: Banknote, text: "الدفع عند الاستلام" },
              { icon: RefreshCw, text: "تبديل مجاني للمقاس" },
              { icon: Truck, text: "التوصيل فابور" },
            ].map((t) => (
              <div key={t.text} className="flex items-center justify-center gap-2 py-2">
                <t.icon className="h-5 w-5 text-emerald-600" />
                <span className="font-semibold text-stone-700">{t.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. Gallery ──────────────────────────────── */}
        {gallery.length > 0 && (
          <section className="py-6 pb-10">
            <h2 className="text-2xl font-extrabold mb-4">صور المنتج</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {gallery.map((src, i) => (
                <div
                  key={src}
                  className="relative aspect-square rounded-2xl overflow-hidden border border-stone-200 bg-stone-50"
                >
                  <Image
                    src={src}
                    alt={`${product.name} — صورة ${i + 2}`}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── 8. Footer ─────────────────────────────────── */}
      <footer className="border-t border-stone-100 py-6">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-2">
          <p className="text-stone-600 text-sm">
            © 2026 ShoeSpot — الدفع عند الاستلام فجميع المغرب
          </p>
          <Link
            href="/login"
            className="text-stone-400 text-xs hover:text-stone-500 transition-colors"
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
                  <span className="text-emerald-600 ltr-num">
                    {Math.round(product.offerTotalMad ?? 0)} درهم
                  </span>{" "}
                  {product.offerQty === 2 ? "للزوج" : `لـ${product.offerQty}`}
                </span>
                <span className="text-xs text-stone-400 ltr-num">
                  الوحدة {Math.round(product.priceMad)} درهم
                </span>
              </>
            ) : (
              <span className="text-xl font-extrabold text-emerald-600 ltr-num">
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
