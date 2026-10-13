import { formatCurrency } from "@/constants";
import type { CartItem } from "@/types";

interface CartDrawerProps {
  items: CartItem[];
}

export function CartDrawer({ items }: CartDrawerProps) {
  const unresolvedQuantity = items
    .filter((item) => item.needs_selection)
    .reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce(
    (sum, item) => sum + (item.needs_selection ? 0 : Number(item.price_at_add ?? item.product.price) * item.quantity),
    0
  );
  const deliveryFee = new Set(items.map((item) => item.product.vendor_id)).size * 1000;
  const total = subtotal + deliveryFee;

  return (
    <aside className="space-y-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold">Cart</h3>
        <p className="mt-2 text-sm text-muted">Review your items and total before paying.</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Your cart is empty.</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 break-words font-medium text-text">{item.product.name}</p>
                    {item.selected_color && <p className="text-sm text-muted">Color: {item.selected_color}</p>}
                    {item.selected_size && <p className="text-sm text-muted">Size: {item.selected_size}</p>}
                    {item.needs_selection && <p className="text-sm font-semibold text-warning">Select options</p>}
                    <p className="text-sm text-muted">Qty: {item.quantity}</p>
                  </div>
                  <p className="min-w-0 break-words text-right font-display font-semibold text-accent-text">
                    {item.needs_selection
                      ? `From ₦${Number(item.price_at_add ?? item.product.price).toLocaleString()}`
                      : `₦${(Number(item.price_at_add ?? item.product.price) * item.quantity).toLocaleString()}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md bg-bg p-4 text-sm text-muted">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-2">
              <span>{unresolvedQuantity ? "Resolved subtotal" : "Subtotal"}</span>
              <span className="break-words text-right font-display">{formatCurrency(subtotal, "NGN", "en-NG")}</span>
            </div>
            {unresolvedQuantity > 0 && (
              <p className="pb-2 text-xs text-muted">Choose options for {unresolvedQuantity} items to see the full total.</p>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-2">
              <span>Delivery fee</span>
              <span className="break-words text-right font-display">{formatCurrency(deliveryFee, "NGN", "en-NG")}</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-2 font-semibold text-text">
              <span>Total</span>
              <span className="break-words text-right font-display">{formatCurrency(total, "NGN", "en-NG")}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
