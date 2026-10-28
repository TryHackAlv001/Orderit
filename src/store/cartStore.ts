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
  changeVariant: (
    itemId: string,
    variant: { id: string; size: string | null; color: string | null; stock_quantity: number },
  ) => CartVariantChange | null;
  rollbackVariantChange: (change: CartVariantChange) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  acceptPrice: (itemId: string) => void;
  replaceItems: (items: CartItem[]) => void;
  removeItem: (id: string) => void;
  removeProducts: (productIds: string[]) => void;
  clearCart: () => void;
  clearSignedInItems: (userId?: string) => void;
}

export interface CartVariantChange {
  previousItems: CartItem[];
  nextItem: CartItem;
  requestedQuantity: number;
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
      changeVariant: (itemId, variant) => {
        let change: CartVariantChange | null = null;
        set((state) => {
          const item = state.items.find((current) => current.id === itemId);
          if (!item || item.variant_id === variant.id) return state;

          const nextId = `${item.product.id}::variant:${variant.id}`;
          const existing = state.items.find((current) => current.id === nextId && current.id !== itemId);
          const requestedQuantity = item.quantity + (existing?.quantity ?? 0);
          const nextItem: CartItem = {
            ...(existing ?? item),
            id: nextId,
            database_id: existing?.database_id ?? item.database_id,
            product: { ...item.product, price: Number(item.product.price) },
            quantity: Math.min(variant.stock_quantity, requestedQuantity),
            variant_id: variant.id,
            needs_selection: false,
            selected_size: variant.size,
            selected_color: variant.color,
            price_at_add: Number(item.product.price),
            active_variant_count_at_add: item.active_variant_count_at_add,
            synced_user_id: existing?.synced_user_id ?? item.synced_user_id,
          };
          const previousItems = existing ? [item, existing] : [item];
          const affectedIds = new Set(previousItems.map((current) => current.id));

          change = { previousItems, nextItem, requestedQuantity };
          return {
            items: state.items.filter((current) => !affectedIds.has(current.id)).concat(nextItem),
          };
        });
        return change;
      },
      rollbackVariantChange: (change) => set((state) => {
        const affectedIds = new Set([
          change.nextItem.id,
          ...change.previousItems.map((item) => item.id),
        ]);
        return {
          items: state.items
            .filter((item) => !affectedIds.has(item.id))
            .concat(change.previousItems),
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
      clearSignedInItems: (userId) => set((state) => ({
        items: state.items.filter((item) =>
          userId
            ? item.synced_user_id !== userId && !item.database_id
            : !item.synced_user_id && !item.database_id,
        ),
      })),
    }),
    {
      name: "cart-storage",
    }
  )
);
