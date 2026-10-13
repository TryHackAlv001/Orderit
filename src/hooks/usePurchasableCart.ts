"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { isOwnProduct } from "@/lib/is-own-product";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";

export function usePurchasableCart() {
  const supabase = useMemo(() => createClient(), []);
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const markNeedsSelection = useCartStore((state) => state.markNeedsSelection);
  const userId = useAuthStore((state) => state.user?.id);

  const purchasableItems = useMemo(
    () => items.filter((item) => !isOwnProduct(item.product.vendor_id, userId)),
    [items, userId],
  );

  useEffect(() => {
    const purchasableItems = items.filter((item) => !userId || !isOwnProduct(item.product.vendor_id, userId));
    if (userId) {
      items.forEach((item) => {
        if (isOwnProduct(item.product.vendor_id, userId)) removeItem(item.id);
      });
    }
    const productIds = Array.from(new Set(purchasableItems.map((item) => item.product.id)));
    if (!productIds.length) return;
    let cancelled = false;
    void supabase
      .from("product_variants")
      .select("id,product_id,stock_quantity")
      .in("product_id", productIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Unable to verify cart variant availability:", error.message);
          return;
        }
        const byProduct = new Map<string, { id: string; stock_quantity: number }[]>();
        (data ?? []).forEach((variant) => {
          if (!variant.product_id) return;
          const productVariants = byProduct.get(variant.product_id) ?? [];
          productVariants.push({ id: variant.id, stock_quantity: variant.stock_quantity });
          byProduct.set(variant.product_id, productVariants);
        });
        const currentItems = useCartStore.getState().items;
        currentItems.forEach((item) => {
          const variants = byProduct.get(item.product.id) ?? [];
          const availableVariants = variants.filter((variant) => variant.stock_quantity > 0);
          const missingSelectedVariant = Boolean(item.variant_id) && !availableVariants.some((variant) => variant.id === item.variant_id);
          const shouldRequireSelection = missingSelectedVariant ||
            (!item.variant_id && (
              Boolean(item.needs_selection) ||
              (item.active_variant_count_at_add ?? 0) > 1 ||
              (availableVariants.length > 1) ||
              (variants.length > 0 && availableVariants.length === 0)
            ));
          markNeedsSelection(item.id, shouldRequireSelection);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [items, markNeedsSelection, removeItem, supabase, userId]);

  return purchasableItems;
}
