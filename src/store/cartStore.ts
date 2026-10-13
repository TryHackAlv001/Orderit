import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";

interface CartState {
  items: CartItem[];
  pulseVersion: number;
  addItem: (item: CartItem) => void;
  rollbackAdd: (itemId: string, quantity: number) => void;
  markSynced: (itemId: string, databaseId: string, userId: string) => void;
  markNeedsSelection: (itemId: string, needsSelection: boolean) => void;
  resolveItem: (itemId: string, variant: { id: string; size: string | null; color: string | null }) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  acceptPrice: (itemId: string) => void;
  replaceItems: (items: CartItem[]) => void;
  removeItem: (id: string) => void;
  removeProducts: (productIds: string[]) => void;
  clearCart: () => void;
}

export function getCartLineId(item: Pick<CartItem, "product" | "variant_id" | "needs_selection" | "selected_size">) {
  if (item.variant_id) return `${item.product.id}::variant:${item.variant_id}`;
  if (item.needs_selection) return `${item.product.id}::needs-selection`;
  if (item.selected_size) return `${item.product.id}::legacy-size:${item.selected_size}`;
  return `${item.product.id}::default`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      pulseVersion: 0,
      addItem: (item) => set((state) => {
        const normalizedItem = {
          ...item,
          id: getCartLineId(item),
          variant_id: item.variant_id ?? null,
          needs_selection: item.needs_selection ?? false,
          price_at_add: item.price_at_add ?? Number(item.product.price),
        };
        const existing = state.items.find((current) => current.id === normalizedItem.id);
        return {
          items: existing
            ? state.items.map((current) => current.id === normalizedItem.id
              ? { ...current, quantity: current.quantity + item.quantity }
              : current)
            : [...state.items, normalizedItem],
          pulseVersion: state.pulseVersion + 1,
        };
      }),
      rollbackAdd: (itemId, quantity) => set((state) => ({
        items: state.items.flatMap((item) => {
          if (item.id !== itemId) return [item];
          const remaining = item.quantity - quantity;
          return remaining > 0 ? [{ ...item, quantity: remaining }] : [];
        }),
      })),
      markSynced: (itemId, databaseId, userId) => set((state) => ({
        items: state.items.map((item) => item.id === itemId
          ? { ...item, database_id: databaseId, synced_user_id: userId }
          : item),
      })),
      markNeedsSelection: (itemId, needsSelection) => set((state) => {
        const item = state.items.find((current) => current.id === itemId);
        if (!item || item.needs_selection === needsSelection) return state;
        return {
          items: state.items.map((current) => current.id === itemId
            ? { ...current, needs_selection: needsSelection }
            : current),
        };
      }),
      resolveItem: (itemId, variant) => set((state) => {
        const item = state.items.find((current) => current.id === itemId);
        if (!item) return state;
        const resolved = {
          ...item,
          id: `${item.product.id}::variant:${variant.id}`,
          variant_id: variant.id,
          needs_selection: false,
          selected_size: variant.size,
          selected_color: variant.color,
        };
        const existing = state.items.find((current) => current.id === resolved.id);
        return {
          items: existing
            ? state.items
                .filter((current) => current.id !== itemId && current.id !== resolved.id)
                .concat({ ...existing, quantity: existing.quantity + item.quantity })
            : state.items.map((current) => current.id === itemId ? resolved : current),
        };
      }),
      updateQuantity: (itemId, quantity) => set((state) => ({
        items: quantity > 0
          ? state.items.map((item) => item.id === itemId ? { ...item, quantity } : item)
          : state.items.filter((item) => item.id !== itemId),
      })),
      acceptPrice: (itemId) => set((state) => ({
        items: state.items.map((item) => item.id === itemId
          ? { ...item, price_at_add: Number(item.product.price) }
          : item),
      })),
      replaceItems: (items) => set({ items }),
      removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      removeProducts: (productIds) => {
        const purchasedProductIds = new Set(productIds);
        set((state) => ({
          items: state.items.filter((item) => !purchasedProductIds.has(item.product.id)),
        }));
      },
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "cart-storage",
    }
  )
);
