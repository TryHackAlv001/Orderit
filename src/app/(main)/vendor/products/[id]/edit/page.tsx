"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CatalogProductForm } from "@/components/vendor/CatalogProductForm";
import type { CatalogOptions } from "@/lib/product-attributes";
import type { ProductVariant } from "@/types";

interface EditableProduct {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  category_id: string;
  price: number;
  compare_price: number | null;
  minimum_order: number;
  tags: string[];
  stock_quantity: number;
  sku: string | null;
  is_active: boolean;
  images: string[];
  is_complete: boolean;
  variants: ProductVariant[];
}

export default function EditVendorProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id;
  const [options, setOptions] = useState<CatalogOptions | null>(null);
  const [product, setProduct] = useState<EditableProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof productId !== "string") return;
    Promise.all([
      fetch("/api/vendor/products"),
      fetch(`/api/vendor/products/${productId}`),
    ])
      .then(async ([optionsResponse, productResponse]) => {
        const [optionsResult, productResult] = await Promise.all([
          optionsResponse.json(),
          productResponse.json(),
        ]);
        if (!optionsResponse.ok) throw new Error(optionsResult.error || "Unable to load product options.");
        if (!productResponse.ok) throw new Error(productResult.error || "Unable to load product.");
        setOptions(optionsResult);
        setProduct(productResult.product);
      })
      .catch((loadError: unknown) => {
        const message = loadError instanceof Error ? loadError.message : "Unable to load product.";
        setError(message);
        if (message === "Unauthorized") router.push("/login");
      });
  }, [productId, router]);

  if (error) return <div role="alert" className="m-4 rounded-lg bg-danger/10 p-4 text-danger-text">{error}</div>;
  if (!options || !product) return <div className="flex min-h-[300px] items-center justify-center text-muted">Loading product…</div>;

  return <div className="min-w-0 px-0 py-6 md:px-4"><CatalogProductForm mode="edit" options={options} product={product} /></div>;
}
