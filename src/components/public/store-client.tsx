"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Star, ArrowRight, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingClient } from "./landing-client";
import type { ProductDTO } from "@/lib/types";

interface StoreClientProps {
  products: ProductDTO[];
}

export function StoreClient({ products }: StoreClientProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductDTO | null>(null);

  if (products.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-xl font-bold text-stone-500">لا توجد منتجات حالياً</p>
      </div>
    );
  }

  // If there's only one product and it's selected (or not), we can just show LandingClient directly
  // But let's follow the requirement: if they select a model, they see it.
  
  return (
    <AnimatePresence mode="wait">
      {selectedProduct ? (
        <motion.div
          key="product-detail"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <LandingClient
            product={selectedProduct}
            onBack={() => setSelectedProduct(null)}
          />
        </motion.div>
      ) : (
        <motion.div
          key="storefront"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen bg-stone-50 text-stone-900 pb-24"
        >
          {/* Header */}
          <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-200 shadow-sm">
            <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
              <span className="bg-stone-950 rounded-xl px-3 py-2 flex items-center shrink-0">
                <Image
                  src="/logo.png"
                  alt="ShoeSpot"
                  width={100}
                  height={32}
                  priority
                  className="h-7 w-auto object-contain"
                />
              </span>
              <div className="flex items-center gap-3">
                <Badge className="hidden sm:inline-flex bg-brand/20 text-brand-strong border-brand/30 hover:bg-brand/30 px-3 py-1 text-sm font-bold">
                  توصيل مجاني + الدفع عند الاستلام
                </Badge>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-stone-600 hover:text-stone-950" asChild>
                  <Link href="/admin" aria-label="لوحة التحكم">
                    <UserCircle className="h-6 w-6" />
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          <main className="max-w-5xl mx-auto px-4 pt-10">
            <div className="text-center space-y-4 mb-10">
              <h1 className="text-4xl md:text-5xl font-black text-stone-950">
                اختار الموديل لي يناسبك
              </h1>
              <p className="text-lg text-stone-600 max-w-2xl mx-auto">
                اكتشف تشكيلتنا الجديدة من الأحذية الرياضية العالية الجودة. جميع الموديلات كتجي مع تبديل مجاني للمقاس.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((p) => {
                const mainImage = p.imageUrls[0] || "/placeholder.png";
                return (
                  <Card 
                    key={p.id} 
                    className="group cursor-pointer overflow-hidden border-2 border-transparent hover:border-brand-strong transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 bg-white"
                    onClick={() => setSelectedProduct(p)}
                  >
                    <div className="aspect-square relative overflow-hidden bg-stone-100">
                      <img
                        src={mainImage}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {p.offerQty && (
                        <div className="absolute top-3 end-3 bg-brand-strong text-stone-950 font-bold px-3 py-1 rounded-full text-xs shadow-md">
                          عرض خاص
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5 space-y-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-semibold text-stone-600">4.9/5</span>
                        </div>
                        <h2 className="text-xl font-extrabold text-stone-950 line-clamp-1">{p.name}</h2>
                      </div>
                      
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-black text-brand-strong ltr-num flex items-baseline gap-1">
                            {Math.round(p.priceMad)} <span className="text-sm text-stone-500 font-bold">درهم</span>
                          </p>
                          {p.oldPriceMad && (
                            <p className="text-sm text-stone-400 line-through ltr-num">
                              {Math.round(p.oldPriceMad)} درهم
                            </p>
                          )}
                        </div>
                        <Button size="icon" className="h-10 w-10 rounded-full bg-stone-950 text-white group-hover:bg-brand-strong group-hover:text-stone-950 transition-colors">
                          <ArrowRight className="h-5 w-5 rtl:-scale-x-100" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
