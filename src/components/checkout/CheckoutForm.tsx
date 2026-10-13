"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PaymentButtons } from "./PaymentButtons";
import type { CartItem } from "@/types";
import { useAuth } from "@/hooks/useAuth";

interface CheckoutFormProps {
  items: CartItem[];
}

interface VendorCartGroup {
  vendorId: string;
  items: CartItem[];
}

export function CheckoutForm({ items }: CheckoutFormProps) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isReadyForPayment, setIsReadyForPayment] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const returnToDetails = () => setIsReadyForPayment(false);
    window.addEventListener("checkout-back-to-details", returnToDetails);
    return () => window.removeEventListener("checkout-back-to-details", returnToDetails);
  }, []);

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
  }, [user?.full_name]);

  const unresolvedQuantity = items
    .filter((item) => item.needs_selection)
    .reduce((sum, item) => sum + item.quantity, 0);
  const hasPriceChange = items.some((item) =>
    Number(item.price_at_add ?? item.product.price) !== Number(item.product.price)
  );
  const subtotal = items.reduce(
    (sum, item) => sum + (item.needs_selection ? 0 : Number(item.price_at_add ?? item.product.price) * item.quantity),
    0
  );
  const vendorGroups = items.reduce<VendorCartGroup[]>((groups, item) => {
    const group = groups.find((current) => current.vendorId === item.product.vendor_id);
    if (group) group.items.push(item);
    else groups.push({ vendorId: item.product.vendor_id, items: [item] });
    return groups;
  }, []);
  const deliveryFee = vendorGroups.length * 1000;
  const total = subtotal + deliveryFee;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user?.email) {
      setError("Please sign in to complete checkout.");
      return;
    }

    if (!fullName.trim() || !deliveryAddress.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (items.length === 0) {
      setError("Cart is empty.");
      return;
    }
    if (unresolvedQuantity > 0) {
      setError(`Choose options for ${unresolvedQuantity} items to continue.`);
      return;
    }
    if (hasPriceChange) {
      setError("A product price changed. Return to your cart to review and accept the updated price.");
      return;
    }
    setIsReadyForPayment(true);
  };

  if (isReadyForPayment) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm" data-checkout-step="payment-options">
        <div className="space-y-2">
          <h3 className="font-semibold text-text">Order Summary</h3>
          <div className="space-y-1 text-sm text-muted">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span>Subtotal:</span>
              <span className="break-words text-right font-display">₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span>Delivery Fee:</span>
              <span className="break-words text-right font-display">₦{deliveryFee.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-1 font-semibold text-text">
              <span>Total:</span>
              <span className="break-words text-right font-display">₦{total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-text">Delivery Address</h3>
          <p className="text-sm text-muted">{deliveryAddress}</p>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-text">Seller orders</h3>
          <p className="text-sm text-muted">
            Each seller order is created when you choose a payment option. Pay sellers one at a time.
          </p>
          {vendorGroups.map((group) => {
            const vendorName = group.items[0]?.vendor?.shop_name ?? "Vendor Store";
            const vendorSubtotal = group.items.reduce(
              (sum, item) => sum + Number(item.price_at_add ?? item.product.price) * item.quantity,
              0
            );
            const orderItems = group.items.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              variantId: item.variant_id ?? null,
              expectedPrice: Number(item.price_at_add ?? item.product.price),
              selectedSize: item.selected_size ?? null,
              selectedColor: item.selected_color ?? null,
            }));
            return (
              <section key={group.vendorId} className="min-w-0 space-y-3 rounded-md border border-border p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <h4 className="min-w-0 break-words font-semibold text-text">{vendorName}</h4>
                  <span className="min-w-0 break-words text-right text-sm text-muted">₦{(vendorSubtotal + 1000).toLocaleString()}</span>
                </div>
                {group.items.map((item) => (
                  <p key={item.id} className="break-words text-sm text-muted">
                    {item.product.name}{item.selected_size ? ` · Size: ${item.selected_size}` : ""} · Qty {item.quantity}
                  </p>
                ))}
                <PaymentButtons
                  items={orderItems}
                  deliveryAddress={deliveryAddress}
                  customerName={fullName}
                  email={user?.email ?? ""}
                  customerPhone={user?.phone}
                />
              </section>
            );
          })}
        </div>

      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-unsaved-form={isDirty ? "true" : undefined}
      className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger-text">
          {error}
        </div>
      )}

      {unresolvedQuantity > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm font-medium text-text">
          Choose options for {unresolvedQuantity} items to continue.
        </div>
      )}
      {hasPriceChange && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm font-medium text-text">
          A product price changed. Return to your cart to review and accept the updated price.
        </div>
      )}

      {!user?.email && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-text">
          You must be signed in to place an order.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text">
          Full Name
        </label>
        <Input
          placeholder="Enter your full name"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            setIsDirty(true);
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text">
          Delivery Address
        </label>
        <Input
          placeholder="Enter your delivery address"
          value={deliveryAddress}
          onChange={(e) => {
            setDeliveryAddress(e.target.value);
            setIsDirty(true);
          }}
        />
      </div>

      <div className="space-y-2 rounded-md bg-bg p-4">
        <h3 className="font-semibold text-text">Order Summary</h3>
        <div className="space-y-1 text-sm text-muted">
          <div className="flex justify-between">
            <span>{items.length} item(s)</span>
            <span className="font-display">₦{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery ({new Set(items.map((item) => item.product.vendor_id)).size} seller orders):</span>
            <span className="font-display">₦{deliveryFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold text-text">
            <span>Total:</span>
            <span className="font-display">₦{total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={items.length === 0 || !user?.email || unresolvedQuantity > 0 || hasPriceChange}
        className="w-full"
      >
        Continue to Payment Options
      </Button>
    </form>
  );
}
