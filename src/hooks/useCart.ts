"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { isOwnProduct } from "@/lib/is-own-product";
import { getCartLineId, useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import type { CartItem, Product, ProductVariant } from "@/types";

type CartRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  selected_size: string | null;
  active_variant_count_at_add: number;
  price_at_add: number;
  product: Product | null;
  vendor: { id: string; shop_name: string } | null;
};

export function useCart() {
  const supabase = useMemo(() => createClient(), []);
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    let cancelled = false;

    async function syncCart() {
      setLoading(true);
      const currentItems = useCartStore.getState().items;
      const guestItems = currentItems.filter((item) =>
        !item.synced_user_id && !isOwnProduct(item.product.vendor_id, currentUser.id)
      );
      let failedGuestItems: CartItem[] = [];

      for (const item of guestItems) {
        const { data, error } = await supabase.rpc("add_cart_item", {
          p_product_id: item.product.id,
          p_variant_id: item.variant_id ?? null,
          p_quantity: item.quantity,
          p_price_at_add: item.price_at_add ?? Number(item.product.price),
        });
        if (error) {
          console.error("Guest cart merge failed:", error.message);
          failedGuestItems.push(item);
          continue;
        }
        const cartRow = Array.isArray(data) ? data[0] : data;
        if (cartRow?.id) {
          useCartStore.getState().markSynced(item.id, cartRow.id, currentUser.id);
        } else {
          failedGuestItems.push(item);
        }
      }
      if (failedGuestItems.length) {
        toast.error("Some items could not be synced to your account cart.");
      }

      const { data, error } = await supabase
        .from("cart_items")
        .select("id,product_id,variant_id,quantity,selected_size,active_variant_count_at_add,price_at_add,product:products(*),vendor:vendor_profiles(id,shop_name)")
        .eq("user_id", currentUser.id);

      if (error) {
        console.error("Error fetching cart from database:", error.message);
        toast.error("Your account cart could not be loaded.");
        setLoading(false);
        return;
      }
      if (!data || cancelled) {
        setLoading(false);
        return;
      }

      const rows = data as unknown as CartRow[];
      const productIds = Array.from(new Set(rows.map((row) => row.product_id)));
      const variantsResult = productIds.length
        ? await supabase.from("product_variants").select("id,product_id,size,color,stock_quantity").in("product_id", productIds)
        : { data: [], error: null };
      if (variantsResult.error) {
        console.error("Cart variant refresh failed:", variantsResult.error.message);
        toast.error("Product options could not be refreshed.");
      }
      const variantsById = new Map(
        ((variantsResult.data ?? []) as ProductVariant[]).map((variant) => [variant.id, variant])
      );
      const variantsByProduct = new Map<string, ProductVariant[]>();
      ((variantsResult.data ?? []) as ProductVariant[]).forEach((variant) => {
        if (!variant.product_id) return;
        const productVariants = variantsByProduct.get(variant.product_id) ?? [];
        productVariants.push(variant);
        variantsByProduct.set(variant.product_id, productVariants);
      });
      const databaseItems: CartItem[] = rows.flatMap((row) => {
        if (!row.product || isOwnProduct(row.product.vendor_id, currentUser.id)) return [];
        const variant = row.variant_id ? variantsById.get(row.variant_id) : null;
        const productVariants = variantsByProduct.get(row.product_id) ?? [];
        const needsSelection = row.variant_id
          ? !variant || variant.stock_quantity <= 0
          : row.active_variant_count_at_add > 1 ||
            (row.active_variant_count_at_add === 0 && productVariants.length > 0);
        return [{
          id: getCartLineId({
            product: row.product,
            variant_id: row.variant_id,
            needs_selection: needsSelection,
            selected_size: row.selected_size,
          }),
          database_id: row.id,
          product: row.product,
          quantity: row.quantity,
          variant_id: row.variant_id,
          needs_selection: needsSelection,
          active_variant_count_at_add: row.active_variant_count_at_add,
          price_at_add: Number(row.price_at_add),
          selected_size: variant?.size ?? row.selected_size,
          selected_color: variant?.color ?? null,
          synced_user_id: currentUser.id,
          vendor: row.vendor ?? { id: row.product.vendor_id, shop_name: "Vendor Store" },
        }];
      });
      const databaseLineIds = new Set(databaseItems.map((item) => item.id));
      const currentLocalItems = useCartStore.getState().items.filter((item) =>
        (item.synced_user_id === currentUser.id && !databaseLineIds.has(item.id)) ||
        failedGuestItems.some((failed) => failed.id === item.id)
      );
      if (!cancelled) {
        useCartStore.getState().replaceItems([
          ...databaseItems,
          ...currentLocalItems.filter((item) => !databaseLineIds.has(item.id)),
        ]);
      }
      setLoading(false);
    }

    void syncCart();
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  return { loading };
}
