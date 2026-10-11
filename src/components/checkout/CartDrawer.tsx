import { formatCurrency } from "@/constants";
import type { CartItem } from "@/types";
import { useCart } from "@/hooks/useCart";

interface CartDrawerProps {
  items: CartItem[];
}

export function CartDrawer({ items }: CartDrawerProps) {
  const { loading } = useCart();

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const deliveryFee = 1000;
  const total = subtotal + deliveryFee;

  return (
    <aside className="space-y-6 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold">Cart</h3>
        <p className="mt-2 text-sm text-muted">Review your items and total before paying.</p>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      )}

      {items.length === 0 && !loading ? (
        <p className="text-sm text-muted">Your cart is empty.</p>
      ) : (
        <div className={`space-y-4 ${loading ? 'opacity-50' : ''}`}>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-text">{item.product.name}</p>
                    {item.selected_size && <p className="text-sm text-muted">Size: {item.selected_size}</p>}
                    <p className="text-sm text-muted">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-display font-semibold text-accent-text">
                    ₦{(item.product.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md bg-bg p-4 text-sm text-muted">
            <div className="flex justify-between pb-2">
              <span>Subtotal</span>
              <span className="font-display">{formatCurrency(subtotal, "NGN", "en-NG")}</span>
            </div>
            <div className="flex justify-between pb-2">
              <span>Delivery fee</span>
              <span className="font-display">{formatCurrency(deliveryFee, "NGN", "en-NG")}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold text-text">
              <span>Total</span>
              <span className="font-display">{formatCurrency(total, "NGN", "en-NG")}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
