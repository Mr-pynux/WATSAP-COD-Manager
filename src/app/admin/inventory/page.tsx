"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Plus, ImagePlus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ProductDTO } from "@/lib/types";
import { getProductsServer, updateProductServer, createProductServer } from "../products/actions";

export default function InventorySheetPage() {
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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

  async function updateField(id: string, field: keyof ProductDTO, value: any) {
    if (!products) return;
    const original = products.find(p => p.id === id);
    if (original?.[field] === value) return; // no change

    // Optimistic update
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
    setSavingId(id);

    try {
      await updateProductServer(id, { [field]: value });
    } catch (e: any) {
      toast.error("فشل الحفظ: " + e.message);
      // Revert on failure
      load();
    } finally {
      setSavingId(null);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, id: string) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Successfully uploaded! Update product's imageUrls
      const product = products?.find(p => p.id === id);
      if (product) {
        const newImages = [data.url, ...product.imageUrls];
        await updateField(id, "imageUrls", newImages);
        toast.success("تم رفع الصورة بنجاح!");
      }
    } catch (err: any) {
      toast.error("فشل رفع الصورة: " + err.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function addEmptyRow() {
    setSavingId("new");
    try {
      const res = await createProductServer({
        name: "منتج جديد",
        priceMad: 0,
        costMad: 0,
        sizes: [],
        colors: [],
        imageUrls: [],
        active: false,
      });
      toast.success("تمت إضافة سطر جديد!");
      await load(); // Reload to get the new ID
    } catch (e: any) {
      toast.error("فشل إضافة السطر: " + e.message);
    } finally {
      setSavingId(null);
    }
  }

  if (products === null) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold">شيت المخزون (Inventory Sheet)</h2>
        <p className="text-sm text-muted-foreground">
          يمكنك تعديل المنتجات، رفع الصور، وتحديث المقاسات المتبقية مباشرة من هذا الجدول (يحفظ تلقائياً).
        </p>
      </div>

      <div className="border rounded-lg bg-card overflow-x-auto shadow-sm">
        <table className="w-full text-sm text-right min-w-[800px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-3 font-semibold text-muted-foreground w-16">الصورة</th>
              <th className="p-3 font-semibold text-muted-foreground">اسم الموديل</th>
              <th className="p-3 font-semibold text-muted-foreground w-28">السعر (درهم)</th>
              <th className="p-3 font-semibold text-muted-foreground w-28">التكلفة (درهم)</th>
              <th className="p-2 font-semibold text-muted-foreground text-center w-12">39</th>
              <th className="p-2 font-semibold text-muted-foreground text-center w-12">40</th>
              <th className="p-2 font-semibold text-muted-foreground text-center w-12">41</th>
              <th className="p-2 font-semibold text-muted-foreground text-center w-12">42</th>
              <th className="p-2 font-semibold text-muted-foreground text-center w-12">43</th>
              <th className="p-2 font-semibold text-muted-foreground text-center w-12">44</th>
              <th className="p-2 font-semibold text-muted-foreground text-center w-12">45</th>
              <th className="p-3 font-semibold text-muted-foreground min-w-[120px]">المقاسات (عام)</th>
              <th className="p-3 font-semibold text-muted-foreground w-24 text-center">حفظ</th>
              <th className="p-3 font-semibold text-muted-foreground w-20 text-center">مفعل</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                {/* Image Cell */}
                <td className="p-2 align-middle">
                  <div className="relative h-12 w-12 rounded bg-stone-100 overflow-hidden border group">
                    {p.imageUrls[0] ? (
                      <img src={p.imageUrls[0]} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full w-full text-stone-400">
                        <ImagePlus className="h-4 w-4" />
                      </div>
                    )}
                    {/* Hover Upload Button */}
                    <label className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      {uploadingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, p.id)}
                        disabled={uploadingId === p.id}
                      />
                    </label>
                  </div>
                </td>

                {/* Name */}
                <td className="p-2 align-middle">
                  <Input 
                    defaultValue={p.name}
                    onBlur={(e) => updateField(p.id, "name", e.target.value)}
                    className="h-9 border-transparent hover:border-input focus:border-input bg-transparent"
                  />
                </td>

                {/* Price */}
                <td className="p-2 align-middle">
                  <Input 
                    type="number"
                    defaultValue={p.priceMad}
                    onBlur={(e) => updateField(p.id, "priceMad", Number(e.target.value))}
                    className="h-9 border-transparent hover:border-input focus:border-input bg-transparent ltr-num"
                  />
                </td>

                {/* Cost */}
                <td className="p-2 align-middle">
                  <Input 
                    type="number"
                    defaultValue={p.costMad}
                    onBlur={(e) => updateField(p.id, "costMad", Number(e.target.value))}
                    className="h-9 border-transparent hover:border-input focus:border-input bg-transparent ltr-num"
                  />
                </td>

                {/* Stock per size 39-45 */}
                {["39", "40", "41", "42", "43", "44", "45"].map(size => (
                  <td key={size} className="p-1 align-middle">
                    <Input 
                      defaultValue={p.stockBySize?.[size] || ""}
                      placeholder="-"
                      onBlur={(e) => {
                        const newStock = { ...(p.stockBySize || {}), [size]: e.target.value };
                        updateField(p.id, "stockBySize", newStock);
                      }}
                      className="h-8 w-12 px-1 text-center border-transparent hover:border-input focus:border-input bg-transparent ltr-num"
                    />
                  </td>
                ))}

                {/* Sizes General */}
                <td className="p-2 align-middle">
                  <Input 
                    defaultValue={p.sizes.join(", ")}
                    placeholder="مثال: 39, 40"
                    onBlur={(e) => {
                      const sizeArray = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                      updateField(p.id, "sizes", sizeArray);
                    }}
                    className="h-9 border-transparent hover:border-input focus:border-input bg-transparent ltr-num text-right"
                  />
                </td>

                {/* Save Status Indicator */}
                <td className="p-2 align-middle text-center text-muted-foreground">
                  {savingId === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto text-brand" />
                  ) : (
                    <Save className="h-4 w-4 mx-auto opacity-20" />
                  )}
                </td>

                {/* Active Switch */}
                <td className="p-2 align-middle text-center">
                  <Switch 
                    checked={p.active} 
                    onCheckedChange={(checked) => updateField(p.id, "active", checked)} 
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button onClick={addEmptyRow} disabled={savingId === "new"} className="w-full gap-2 border-dashed border-2 bg-transparent text-foreground hover:bg-muted" variant="outline">
        {savingId === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        إضافة سطر جديد (موديل جديد)
      </Button>

    </div>
  );
}
