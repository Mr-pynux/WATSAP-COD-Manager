"use server";

import { createClient } from "@/utils/supabase/server";
import type { ProductDTO } from "@/lib/types";

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return supabase;
}

export async function getProductsServer(): Promise<{ products: ProductDTO[] }> {
  const supabase = await verifyAdmin();
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  
  if (error) throw new Error(error.message);

  const products = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    imageUrls: row.image_urls || [],
    videoUrl: row.video_url,
    description: row.description,
    features: row.features || [],
    priceMad: row.price_mad,
    oldPriceMad: row.old_price_mad,
    offerQty: row.offer_qty,
    offerTotalMad: row.offer_total_mad,
    costMad: row.cost_mad,
    sizes: row.sizes || [],
    colors: row.colors || [],
    active: row.active,
    stockBySize: row.stock_by_size || {},
  })) as ProductDTO[];

  return { products };
}

export async function updateProductServer(id: string, product: Partial<ProductDTO>) {
  const supabase = await verifyAdmin();
  
  const updates: any = {};
  if (product.name !== undefined) updates.name = product.name;
  if (product.imageUrls !== undefined) updates.image_urls = product.imageUrls;
  if (product.videoUrl !== undefined) updates.video_url = product.videoUrl;
  if (product.description !== undefined) updates.description = product.description;
  if (product.features !== undefined) updates.features = product.features;
  if (product.priceMad !== undefined) updates.price_mad = product.priceMad;
  if (product.oldPriceMad !== undefined) updates.old_price_mad = product.oldPriceMad;
  if (product.offerQty !== undefined) updates.offer_qty = product.offerQty;
  if (product.offerTotalMad !== undefined) updates.offer_total_mad = product.offerTotalMad;
  if (product.costMad !== undefined) updates.cost_mad = product.costMad;
  if (product.sizes !== undefined) updates.sizes = product.sizes;
  if (product.colors !== undefined) updates.colors = product.colors;
  if (product.active !== undefined) updates.active = product.active;
  if (product.stockBySize !== undefined) updates.stock_by_size = product.stockBySize;

  const { error } = await supabase.from("products").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
  
  return { success: true };
}

export async function getProductServer(id: string): Promise<{ product: ProductDTO | null }> {
  if (id === "new") return { product: null };
  const supabase = await verifyAdmin();
  const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
  
  if (error) {
    if (error.code === "PGRST116") return { product: null }; // Not found
    throw new Error(error.message);
  }

  const product = {
    id: data.id,
    name: data.name,
    imageUrls: data.image_urls || [],
    videoUrl: data.video_url,
    description: data.description,
    features: data.features || [],
    priceMad: data.price_mad,
    oldPriceMad: data.old_price_mad,
    offerQty: data.offer_qty,
    offerTotalMad: data.offer_total_mad,
    costMad: data.cost_mad,
    sizes: data.sizes || [],
    colors: data.colors || [],
    active: data.active,
    stockBySize: data.stock_by_size || {},
  } as ProductDTO;

  return { product };
}

export async function createProductServer(product: Partial<ProductDTO>) {
  const supabase = await verifyAdmin();
  
  const insertData = {
    name: product.name,
    image_urls: product.imageUrls,
    video_url: product.videoUrl,
    description: product.description,
    features: product.features,
    price_mad: product.priceMad,
    old_price_mad: product.oldPriceMad,
    offer_qty: product.offerQty,
    offer_total_mad: product.offerTotalMad,
    cost_mad: product.costMad,
    sizes: product.sizes,
    colors: product.colors,
    active: product.active ?? true,
    stock_by_size: product.stockBySize ?? {},
  };

  const { data, error } = await supabase.from("products").insert(insertData).select().single();
  if (error) throw new Error(error.message);
  
  return { 
    success: true, 
    product: {
      id: data.id,
      name: data.name,
      imageUrls: data.image_urls || [],
      videoUrl: data.video_url,
      description: data.description,
      features: data.features || [],
      priceMad: data.price_mad,
      oldPriceMad: data.old_price_mad,
      offerQty: data.offer_qty,
      offerTotalMad: data.offer_total_mad,
      costMad: data.cost_mad,
      sizes: data.sizes || [],
      colors: data.colors || [],
      active: data.active,
      stockBySize: data.stock_by_size || {},
    } as ProductDTO
  };
}

export async function deleteProductServer(id: string) {
  const supabase = await verifyAdmin();
  const { error } = await supabase.from("products").delete().eq("id", id);
  
  if (error) throw new Error(error.message);
  return { success: true };
}
