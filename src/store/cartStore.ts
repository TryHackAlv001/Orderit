import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => {
        const selectedSize = item.selected_size ?? null;
        const existing = state.items.find((current) =>
          current.product.id === item.product.id &&
          (current.selected_size ?? null) === selectedSize
        );
        if (existing) {
          return {
            items: state.items.map((current) =>
              current === existing
                ? { ...current, quantity: current.quantity + item.quantity }
                : current
            ),
          };
        }
        return {
          items: [...state.items, {
            ...item,
            id: `${item.product.id}::${selectedSize ?? "default"}`,
            selected_size: selectedSize,
          }],
        };
      }),
      removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "cart-storage",
    }
  )
);
