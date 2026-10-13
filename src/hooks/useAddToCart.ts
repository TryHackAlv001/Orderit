"use client";

import { useMemo } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { getCartLineId, useCartStore } from "@/store/cartStore";
import { showCartAddedFeedback } from "@/lib/cart-add-feedback";
import type { CartItem } from "@/types";

export function useAddToCart() {
  const supabase = useMemo(() => createClient(), []);
  const user = useAuthStore((state) => state.user);
  const { addItem, markSynced, rollbackAdd } = useCartStore();

  return async (item: CartItem): Promise<boolean> => {
    const optimisticItem: CartItem = {
      ...item,
      id: getCartLineId(item),
      variant_id: item.variant_id ?? null,
      needs_selection: item.needs_selection ?? false,
      price_at_add: item.price_at_add ?? Number(item.product.price),
      synced_user_id: user?.id ?? null,
    };
    addItem(optimisticItem);
    showCartAddedFeedback();

    if (!user) {
      return true;
    }

    try {
      const { data, error } = await supabase.rpc("add_cart_item", {
        p_product_id: item.product.id,
        p_variant_id: item.variant_id ?? null,
        p_quantity: item.quantity,
        p_price_at_add: optimisticItem.price_at_add,
      });
      if (error) throw error;
      const cartRow = Array.isArray(data) ? data[0] : data;
      if (!cartRow?.id) throw new Error("The cart could not be synchronized.");
      markSynced(optimisticItem.id, cartRow.id, user.id);
      return true;
    } catch (error) {
      rollbackAdd(optimisticItem.id, item.quantity);
      const message = error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null &&
          "message" in error && typeof error.message === "string"
          ? error.message
          : "Unable to add this product to your cart.";
      toast.error(message);
      return false;
    }
  };
}
