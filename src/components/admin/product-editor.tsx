"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BadgePercent,
  Check,
  CircleDollarSign,
  ImageIcon,
  Loader2,
  Package,
  Play,
  Plus,
  Save,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { normalizeMediaUrl, youtubeId } from "@/lib/url";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_ASSET_LIBRARY } from "@/lib/constants";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getProductServer, createProductServer, updateProductServer } from "@/app/admin/products/actions";

interface ColorDraft {
  name: string;
  hex: string;
}

interface Draft {
  name: string;
  description: string;
  features: string[];
  imageUrls: string[];
  videoUrl: string;
  price: string;
  oldPrice: string;
  cost: string;
  offerEnabled: boolean;
  offerQty: string;
  offerTotal: string;
  sizes: string;
  colors: ColorDraft[];
  active: boolean;
}

function dtoToDraft(p: ProductDTO): Draft {
  const existingSizes =
    p.sizes && p.sizes.length > 0
      ? p.sizes.join("، ")
      : Object.keys(p.stockBySize || {})
          .filter((k) => {
            const val = String(p.stockBySize?.[k] || "").trim();
            return val !== "" && val !== "0" && val !== "-";
          })
          .sort((a, b) => Number(a) - Number(b))
          .join("، ");

  return {
    name: p.name || "",
    description: p.description ?? "",
    features: p.features || [],
    imageUrls: [...(p.imageUrls || [])],
    videoUrl: p.videoUrl ?? "",
    price: p.priceMad != null ? String(p.priceMad) : "",
    oldPrice: p.oldPriceMad != null ? String(p.oldPriceMad) : "",
    cost: String(p.costMad ?? 0),
    offerEnabled: p.offerQty != null && p.offerTotalMad != null,
    offerQty: String(p.offerQty ?? 2),
    offerTotal: p.offerTotalMad != null ? String(p.offerTotalMad) : "",
    sizes: existingSizes,
    colors: (p.colors || []).map((c) => ({ name: c.name, hex: c.hex })),
    active: p.active,
  };
}

const NEW_DRAFT: Draft = {
  name: "",
  description: "",
  features: [],
  imageUrls: [],
  videoUrl: "",
  price: "150",
  oldPrice: "",
  cost: "",
  offerEnabled: true,
  offerQty: "2",
  offerTotal: "240",
  sizes: "39، 40، 41، 42، 43، 44، 45",
  colors: [
    { name: "أبيض", hex: "#f5f5f4" },
    { name: "أسود", hex: "#1c1917" },
    { name: "بيج", hex: "#d6c8b5" },
  ],
  active: true,
};

interface ProductEditorProps {
  productId: string; // cuid or "new"
}

export function ProductEditor({ productId }: ProductEditorProps) {
  const router = useRouter();
  const isNew = productId === "new";
  const [draft, setDraft] = useState<Draft | null>(null);
  const [original, setOriginal] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [featureInput, setFeatureInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = useCallback((patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }, []);

  const load = useCallback(async () => {
    if (isNew) {
      setDraft(NEW_DRAFT);
      setOriginal(JSON.stringify(NEW_DRAFT));
      return;
    }
    try {
      const res = await getProductServer(productId);
      const found = res.product;
      if (!found) {
        setError("المنتج غير موجود");
        return;
      }
      const d = dtoToDraft(found);
      setDraft(d);
      setOriginal(JSON.stringify(d));
    } catch {
      setError("تعذر تحميل المنتج");
    }
  }, [isNew, productId]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = draft != null && JSON.stringify(draft) !== original;

  const parsedSizes = useMemo(
    () =>
      draft?.sizes
        .split(/[،,]+/)
        .map((s) => s.trim())
        .filter(Boolean) ?? [],
    [draft?.sizes]
  );

  const offerPreview = useMemo(() => {
    if (!draft || !draft.offerEnabled) return null;
    const qty = parseInt(draft.offerQty, 10);
    const total = parseFloat(draft.offerTotal);
    const price = parseFloat(draft.price);
    if (!qty || !total || !price) return null;
    const save = Math.round(qty * price - total);
    return save > 0 ? save : 0;
  }, [draft]);

  /* ── media helpers ─────────────────────────────── */

  function addImageUrl(raw: string) {
    const url = normalizeMediaUrl(raw);
    if (!url) {
      toast.error(
        "الرابط ماشي صحيح — كوبي الرابط كامل (مثال: www.example.com/photo.jpg ولا https://...)"
      );
      return;
    }
    if (draft?.imageUrls.includes(url)) {
      toast.error("هاد الصورة موجودة من قبل");
      return;
    }
    set({ imageUrls: [...(draft?.imageUrls ?? []), url] });
    setUrlInput("");
    toast.success("تزادت الصورة ✓");
  }

  function moveImage(i: number, dir: 1 | -1) {
    if (!draft) return;
    const arr = [...draft.imageUrls];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set({ imageUrls: arr });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          toast.error(data.error || "فشل رفع الصورة");
          continue;
        }
        setDraft((d) => (d ? { ...d, imageUrls: [...d.imageUrls, data.url!] } : d));
      }
      toast.success("ترفعو الصور");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /* ── save ──────────────────────────────────────── */

  async function save() {
    if (!draft) return;
    setError(null);

    const priceMad = parseFloat(draft.price) || 0;
    if (!draft.name.trim()) {
      setError("اسم المنتج مطلوب");
      return;
    }

    const offerQty = draft.offerEnabled ? parseInt(draft.offerQty, 10) : null;
    const offerTotal = draft.offerEnabled ? parseFloat(draft.offerTotal) : null;
    if (offerQty && offerTotal != null && priceMad > 0 && offerTotal >= offerQty * priceMad) {
      setError("ثمن العرض خاصو يكون أقل من ثمن الوحدات منفصلة");
      return;
    }

    // Colors and sizes are completely optional
    const validColors = (draft.colors || []).filter((c) => c && c.name && c.name.trim());

    const payload = {
      name: draft.name.trim(),
      imageUrls: draft.imageUrls || [],
      videoUrl: draft.videoUrl.trim() || null,
      description: draft.description.trim() || null,
      features: draft.features.map((f) => f.trim()).filter(Boolean),
      priceMad,
      oldPriceMad: draft.oldPrice ? parseFloat(draft.oldPrice) : null,
      offerQty,
      offerTotalMad: offerTotal,
      costMad: draft.cost ? parseFloat(draft.cost) : 0,
      sizes: parsedSizes,
      colors: validColors,
      active: draft.active,
    };

    setSaving(true);
    try {
      let result;
      if (isNew) {
        result = await createProductServer(payload);
      } else {
        await updateProductServer(productId, payload);
        result = { product: { ...payload, id: productId } as ProductDTO };
      }
      
      toast.success(isNew ? "تزاد المنتج" : "تسجلت التغييرات — الصفحة الرئيسية تبدلت");
      const d = dtoToDraft(result.product!);
      setDraft(d);
      setOriginal(JSON.stringify(d));
      
      if (isNew && result.product) {
        router.replace(`/admin/products/${result.product.id}`);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "تعذر الاتصال بالسيرفر");
    } finally {
      setSaving(false);
    }
  }

  if (draft === null && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (draft === null) {
    return (
      <Alert variant="destructive">
        <Package className="h-4 w-4" />
        <AlertTitle>مشكل</AlertTitle>
        <AlertDescription>
          {error} —{" "}
          <Link href="/admin/products" className="underline font-bold">
            رجع للائحة
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── header ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-10 w-10">
            <Link href="/admin/products" aria-label="رجع للائحة">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-extrabold">
              {isNew ? "منتج جديد" : "تعديل المنتج"}
            </h2>
            {dirty && (
              <p className="text-xs text-orange-600 font-semibold">
                كاين تغييرات ما تسجلوش
              </p>
            )}
          </div>
        </div>
        <Button onClick={save} disabled={saving || !dirty} className="font-bold gap-2 h-11 px-6">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              كنسجل...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              سجل التغييرات
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <X className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {/* ── media card ────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              الصور والفيديو
            </CardTitle>
            <CardDescription>
              الصورة الأولى هي الرئيسية فالصفحة الرئيسية — رتبهم بالسهم ↑ ↓
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* image rows */}
            <div className="space-y-2">
              {draft.imageUrls.length === 0 && (
                <div className="border-2 border-dashed rounded-xl p-6 text-center text-sm text-muted-foreground">
                  ما كاين حتى صورة — زيد من رابط، من الجهاز، ولا من المكتبة
                </div>
              )}
              {draft.imageUrls.map((url, i) => (
                <div
                  key={url}
                  className="flex items-center gap-2 border rounded-xl p-2 bg-muted/40"
                >
                  <span className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-stone-200 dark:bg-stone-700">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate ltr-num" dir="ltr">
                      {url}
                    </p>
                    {i === 0 ? (
                      <Badge className="mt-1 bg-primary/15 text-stone-900 dark:text-primary border-primary/40 gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        الصورة الرئيسية
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        صورة {i + 1}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveImage(i, -1)}
                      disabled={i === 0}
                      aria-label="حرك فوق"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveImage(i, 1)}
                      disabled={i === draft.imageUrls.length - 1}
                      aria-label="حرك تحت"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() =>
                        set({ imageUrls: draft.imageUrls.filter((u) => u !== url) })
                      }
                      aria-label="حيد الصورة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* add image */}
            <div className="flex gap-2">
              <Input
                dir="ltr"
                placeholder="https://... رابط الصورة"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addImageUrl(urlInput);
                  }
                }}
                className="ltr-num"
              />
              <Button
                type="button"
                variant="secondary"
                className="font-bold shrink-0"
                onClick={() => addImageUrl(urlInput)}
              >
                <Plus className="h-4 w-4" />
                زيد
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                multiple
                hidden
                onChange={(e) => uploadFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                className="gap-2 font-semibold"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                رفع من الجهاز
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="gap-2 font-semibold">
                    <ImageIcon className="h-4 w-4" />
                    المكتبة
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>مكتبة الصور</DialogTitle>
                    <DialogDescription>
                      كليك على صورة باش تزيدها للمنتج
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-3 gap-2">
                    {PRODUCT_ASSET_LIBRARY.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => addImageUrl(url)}
                        className="relative aspect-square rounded-xl overflow-hidden border hover:ring-2 hover:ring-primary transition-all"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                          <Check className="h-6 w-6 text-primary" />
                        </span>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* video */}
            <div className="space-y-2 border-t pt-4">
              <Label className="flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                فيديو المنتج (رابط MP4 ولا رابط يوتيوب)
              </Label>
              <div className="flex gap-2">
                <Input
                  dir="ltr"
                  placeholder="https://youtu.be/... ولا www.youtube.com/watch?v=..."
                  value={draft.videoUrl}
                  onChange={(e) => set({ videoUrl: e.target.value })}
                  onBlur={() => {
                    // auto-fix: add https:// + trim on leave — no more "رابط غير صالح"
                    const norm = normalizeMediaUrl(draft.videoUrl);
                    if (draft.videoUrl.trim() && norm && norm !== draft.videoUrl) {
                      set({ videoUrl: norm });
                    }
                  }}
                  className="ltr-num"
                />
                {draft.videoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => set({ videoUrl: "" })}
                    aria-label="حيد الفيديو"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {draft.videoUrl &&
                (youtubeId(draft.videoUrl) ? (
                  <div className="relative w-full rounded-xl border overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${youtubeId(draft.videoUrl)}`}
                      title="معاينة الفيديو"
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                ) : (
                  <video
                    src={draft.videoUrl}
                    controls
                    muted
                    playsInline
                    className="w-full rounded-xl border max-h-56 object-contain bg-black"
                  />
                ))}
              <p className="text-xs text-muted-foreground">
                الرابط بلا https كيتصلح وحيدو — والفيديو كيبان فعارض 360° فالصفحة الرئيسية
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── info + pricing ────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                المعلومات والأوصاف
              </CardTitle>
              <CardDescription>الوصف والمميزات كيبانو فالصفحة الرئيسية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p-name">اسم المنتج *</Label>
                <Input
                  id="p-name"
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="مثلا: سنيكرز ShoeSpot"
                  className="font-bold"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-desc">الوصف</Label>
                <Textarea
                  id="p-desc"
                  rows={4}
                  value={draft.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="وصف قصير بالدارجة: راحة، خفة، فين كتلبسو..."
                />
                <p className="text-xs text-muted-foreground">
                  {draft.description.length}/2000 حرف
                </p>
              </div>

              <div className="space-y-2">
                <Label>المميزات (نقط كيبانو تحت الوصف)</Label>
                <div className="space-y-2">
                  {draft.features.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={f}
                        onChange={(e) => {
                          const arr = [...draft.features];
                          arr[i] = e.target.value;
                          set({ features: arr });
                        }}
                        placeholder="مثلا: جلد أصلي كيتنفس"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() =>
                          set({ features: draft.features.filter((_, j) => j !== i) })
                        }
                        aria-label="حيد الميزة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {draft.features.length < 10 && (
                  <div className="flex gap-2">
                    <Input
                      value={featureInput}
                      onChange={(e) => setFeatureInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && featureInput.trim()) {
                          e.preventDefault();
                          set({ features: [...draft.features, featureInput.trim()] });
                          setFeatureInput("");
                        }
                      }}
                      placeholder="زيد ميزة + Enter"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="font-bold shrink-0"
                      onClick={() => {
                        if (!featureInput.trim()) return;
                        set({ features: [...draft.features, featureInput.trim()] });
                        setFeatureInput("");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-primary" />
                الأثمنة
              </CardTitle>
              <CardDescription>كل الأثمنة بالدرهم المغربي</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="p-price">ثمن الوحدة *</Label>
                  <Input
                    id="p-price"
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(e) => set({ price: e.target.value })}
                    className="ltr-num font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-old">الثمن القديم (اختياري)</Label>
                  <Input
                    id="p-old"
                    inputMode="decimal"
                    value={draft.oldPrice}
                    onChange={(e) => set({ oldPrice: e.target.value })}
                    placeholder="مثلا: 399"
                    className="ltr-num"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-cost">ثمن التكلفة (للمالية)</Label>
                  <Input
                    id="p-cost"
                    inputMode="decimal"
                    value={draft.cost}
                    onChange={(e) => set({ cost: e.target.value })}
                    placeholder="مثلا: 85"
                    className="ltr-num"
                  />
                </div>
              </div>

              {/* offer */}
              <div className="border rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 font-bold">
                    <BadgePercent className="h-4 w-4 text-primary" />
                    عرض خاص (زوج بثمن أقل)
                  </Label>
                  <Switch
                    checked={draft.offerEnabled}
                    onCheckedChange={(v) => set({ offerEnabled: v })}
                    aria-label="تفعيل العرض الخاص"
                  />
                </div>
                {draft.offerEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="p-oqty">الكمية فالعرض</Label>
                      <Input
                        id="p-oqty"
                        inputMode="numeric"
                        value={draft.offerQty}
                        onChange={(e) => set({ offerQty: e.target.value })}
                        className="ltr-num"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-ototal">ثمن العرض كامل</Label>
                      <Input
                        id="p-ototal"
                        inputMode="decimal"
                        value={draft.offerTotal}
                        onChange={(e) => set({ offerTotal: e.target.value })}
                        placeholder="مثلا: 240"
                        className="ltr-num"
                      />
                    </div>
                  </div>
                )}
                {offerPreview != null && (
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    الكليان غادي يوفّر {offerPreview} درهم مع هاد العرض
                  </p>
                )}
              </div>

              {/* status */}
              <div className="flex items-center justify-between border rounded-xl p-3">
                <div>
                  <Label className="font-bold">المنتج نشط</Label>
                  <p className="text-xs text-muted-foreground">
                    غير النشط كيبان فالصفحة الرئيسية للزوار
                  </p>
                </div>
                <Switch
                  checked={draft.active}
                  onCheckedChange={(v) => set({ active: v })}
                  aria-label="تفعيل المنتج"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── sizes + colors ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>المقاسات والألوان (اختياري)</CardTitle>
          <CardDescription>
            المقاسات بالفاصلة — إلا كنتي عمرتيهم فـ شيت المخزون غيطلعو تلقائياً هنا
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="p-sizes">المقاسات (اختياري)</Label>
            <Input
              id="p-sizes"
              value={draft.sizes}
              onChange={(e) => set({ sizes: e.target.value })}
              className="ltr-num"
              placeholder="مثلا: 39، 40، 41، 42، 43، 44، 45"
            />
            <div className="flex flex-wrap gap-1.5">
              {parsedSizes.map((s) => (
                <Badge key={s} variant="secondary" className="ltr-num font-bold">
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>الألوان (اختياري)</Label>
            <div className="space-y-2">
              {draft.colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c.hex}
                    onChange={(e) => {
                      const arr = [...draft.colors];
                      arr[i] = { ...arr[i], hex: e.target.value };
                      set({ colors: arr });
                    }}
                    aria-label={`لون ${c.name}`}
                    className="h-10 w-12 shrink-0 rounded-lg border cursor-pointer bg-transparent"
                  />
                  <Input
                    value={c.name}
                    onChange={(e) => {
                      const arr = [...draft.colors];
                      arr[i] = { ...arr[i], name: e.target.value };
                      set({ colors: arr });
                    }}
                    placeholder="اسم اللون"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => set({ colors: draft.colors.filter((_, j) => j !== i) })}
                    aria-label="حيد اللون"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2 font-semibold"
              onClick={() => set({ colors: [...draft.colors, { name: "", hex: "#f0c000" }] })}
            >
              <Plus className="h-4 w-4" />
              زيد لون
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* bottom save */}
      <div className={cn("flex justify-end pb-2", !dirty && "opacity-60")}>
        <Button onClick={save} disabled={saving || !dirty} size="lg" className="font-bold gap-2">
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              كنسجل...
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              سجل التغييرات
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
