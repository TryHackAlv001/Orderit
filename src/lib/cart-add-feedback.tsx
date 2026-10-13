"use client";

import Link from "next/link";
import toast from "react-hot-toast";

let addedItemCount = 0;
let resetTimer: ReturnType<typeof setTimeout> | null = null;

export function showCartAddedFeedback() {
  addedItemCount += 1;
  if (resetTimer) clearTimeout(resetTimer);
  resetTimer = setTimeout(() => {
    addedItemCount = 0;
    resetTimer = null;
  }, 2100);

  toast.custom(
    () => (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm text-text shadow-soft">
        <span>{addedItemCount > 1 ? `${addedItemCount} items added` : "Added to cart"}</span>
        <Link href="/cart" className="font-semibold text-accent-text underline underline-offset-2">
          View cart
        </Link>
      </div>
    ),
    { id: "cart-add-feedback", duration: 2000 },
  );
}
