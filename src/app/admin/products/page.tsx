"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BadgePercent,
  ImageIcon,
  Loader2,
  Package,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getProductsServer, updateProductServer, deleteProductServer } from "./actions";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getProductsServer();
      setProducts(res.products);
    } catch {
      toast.error("تعذر تحميل المنتجات");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(p: ProductDTO) {
    setTogglingId(p.id);
    try {
      await updateProductServer(p.id, { active: !p.active });
      toast.success(!p.active ? "تنشّط المنتج — دابا كيبان فالصفحة الرئيسية" : "تطفّى المنتج");
      await load();
    } catch {
      toast.error("تعذر تغيير حالة المنتج");
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteProduct() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProductServer(deleteTarget.id);
      toast.success("تحيد المنتج");
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("تعذر حذف المنتج");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">المنتجات</h2>
          <p className="text-sm text-muted-foreground">
            بدّل الصور والفيديو، الأوصاف والأثمنة — وكتبان دغيا فالصفحة الرئيسية
          </p>
        </div>
        <Button asChild className="font-bold gap-2">
          <Link href="/admin/products/new">
            <Plus className="h-4 w-4" />
            زيد منتج جديد
          </Link>
        </Button>
      </div>

      {/* list */}
      {products === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Package className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="font-bold">ما كاين حتى منتج</p>
            <p className="text-sm text-muted-foreground">
              زيد أول منتج ديالك باش تبدا البيع
            </p>
            <Button asChild className="mt-2 font-bold gap-2">
              <Link href="/admin/products/new">
                <Plus className="h-4 w-4" />
                زيد منتج
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Card
              key={p.id}
              className={cn(
                "overflow-hidden border transition-shadow hover:shadow-md",
                p.active ? "border-border" : "border-dashed opacity-80"
              )}
            >
              {/* thumbnail */}
              <div className="relative aspect-[16/10] bg-stone-100 dark:bg-stone-800">
                {p.imageUrls[0] ? (
                  <img
                    src={p.imageUrls[0]}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute top-2 start-2 flex gap-1.5">
                  <Badge className="bg-stone-950/85 text-white border-stone-950/85 hover:bg-stone-950/85 gap-1">
                    <ImageIcon className="h-3 w-3" />
                    <span className="ltr-num">{p.imageUrls.length}</span>
                  </Badge>
                  {p.videoUrl && (
                    <Badge className="bg-stone-950/85 text-brand border-stone-950/85 hover:bg-stone-950/85 gap-1">
                      <Play className="h-3 w-3 fill-brand" />
                      فيديو
                    </Badge>
                  )}
                </div>
                {!p.active && (
                  <Badge className="absolute top-2 end-2 bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-700 dark:text-stone-200 dark:border-stone-600">
                    مطفيّ
                  </Badge>
                )}
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <p className="font-extrabold truncate">{p.name}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold ltr-num">
                      {Math.round(p.priceMad)} درهم
                    </span>
                    {p.offerQty && p.offerTotalMad != null && (
                      <Badge className="bg-primary/15 text-stone-900 dark:text-primary border-primary/40 gap-1 whitespace-nowrap">
                        <BadgePercent className="h-3 w-3" />
                        {p.offerQty === 2 ? "زوج" : p.offerQty} بـ
                        {Math.round(p.offerTotalMad)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.sizes.length} مقاسات · {p.colors.length} ألوان
                    {p.features.length > 0 && ` · ${p.features.length} مميزات`}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={p.active}
                      onCheckedChange={() => toggleActive(p)}
                      disabled={togglingId === p.id}
                      aria-label={`تفعيل ${p.name}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {togglingId === p.id ? "كنبدلو..." : p.active ? "نشط" : "مطفيّ"}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button asChild size="sm" variant="outline" className="gap-1.5 font-bold">
                      <Link href={`/admin/products/${p.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                        عدّل
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(p)}
                      aria-label={`حيد ${p.name}`}
                    >
                      {deleting && deleteTarget?.id === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تحيد هاد المنتج؟</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" غادي يتمحى نهائياً. إلا كان عندو طلبات، ما يمكنش
              تحيدو — عطّلو غير.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>لأ</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteProduct}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              حيد نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
