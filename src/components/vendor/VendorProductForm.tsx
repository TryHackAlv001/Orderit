"use client";

import { useEffect, useState } from "react";
import { CatalogProductForm, type CatalogEditableProduct } from "@/components/vendor/CatalogProductForm";
import type { CatalogOptions } from "@/lib/product-attributes";
import type { Category, Product } from "@/types";

interface VendorProductFormProps {
  product?: Product;
  categories: Category[];
  mode: "new" | "edit";
}

export function VendorProductForm({ product, categories, mode }: VendorProductFormProps) {
  const [options, setOptions] = useState<CatalogOptions | null>(null);
  const [editableProduct, setEditableProduct] = useState<CatalogEditableProduct | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const optionsResponse = await fetch("/api/vendor/products");
        const optionsResult = await optionsResponse.json();
        if (!optionsResponse.ok) {
          throw new Error(optionsResult.error || "Unable to load product options.");
        }

        let productResult: CatalogEditableProduct | undefined;
        if (mode === "edit") {
          if (!product?.id) throw new Error("Product not found.");
          const productResponse = await fetch(`/api/vendor/products/${product.id}`);
          const result = await productResponse.json();
          if (!productResponse.ok) {
            throw new Error(result.error || "Unable to load product details.");
          }
          productResult = result.product;
        }

        if (!active) return;
        setOptions({
          ...optionsResult,
          categories: categories.length
            ? categories.map(({ id, name, slug }) => ({ id, name, slug }))
            : optionsResult.categories,
        });
        setEditableProduct(productResult);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load product form.");
        }
      }
    };

    void load();
    return () => { active = false; };
  }, [categories, mode, product?.id]);

  if (error) {
    return <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger-text">{error}</p>;
  }
  if (!options || (mode === "edit" && !editableProduct)) {
    return <p role="status" className="p-6 text-center text-sm text-muted">Loading product form…</p>;
  }

  return <CatalogProductForm mode={mode} options={options} product={editableProduct} />;
}
