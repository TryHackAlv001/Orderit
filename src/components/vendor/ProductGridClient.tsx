"use client";

import { useMemo, useState } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types";

interface ProductGridClientProps {
  products: Product[];
  initialViewPublic?: boolean;
}

export function ProductGridClient({ products, initialViewPublic = true }: ProductGridClientProps) {
  const [viewPublic, setViewPublic] = useState(initialViewPublic);

  const visible = useMemo(() => {
    return viewPublic ? products.filter((p) => (p as any).is_active) : products;
  }, [products, viewPublic]);

  if (!visible || visible.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="mt-4 text-muted">No products to display.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visible.map((product) => (
        <div key={product.id} className="relative">
          {!product.is_active && (
            <div className="absolute right-3 top-3 z-10 rounded-full bg-warning/10 px-2 py-1 text-xs font-semibold text-text">
              Draft
            </div>
          )}
          <ProductCard product={{ ...product, vendor: { full_name: (product as any).vendor?.full_name || '' } }} />
        </div>
      ))}
    </div>
  );
}

export default ProductGridClient;
