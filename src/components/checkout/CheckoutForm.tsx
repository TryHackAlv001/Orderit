"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { PaymentButtons } from "./PaymentButtons";
import type { CartItem } from "@/types";
import { useAuth } from "@/hooks/useAuth";

interface CheckoutFormProps {
  items: CartItem[];
  onOrderCreated?: (orderId: string) => void;
}

export function CheckoutForm({ items, onOrderCreated }: CheckoutFormProps) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
  }, [user?.full_name]);

  const subtotal = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const deliveryFee = 1000;
  const total = subtotal + deliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!user?.email) {
        throw new Error("Please sign in to complete checkout.");
      }

      if (!fullName.trim() || !deliveryAddress.trim()) {
        throw new Error("Please fill in all fields.");
      }

      if (items.length === 0) {
        throw new Error("Cart is empty.");
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            selectedSize: item.selected_size ?? null,
          })),
          deliveryAddress,
          customerName: fullName,
          email: user.email,
          customerPhone: user.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Unable to create order.");
      }

      setOrderId(data.orderId);
      onOrderCreated?.(data.orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  if (orderId) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="space-y-2">
          <h3 className="font-semibold text-text">Order Summary</h3>
          <div className="space-y-1 text-sm text-muted">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-display">₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee:</span>
              <span className="font-display">₦{deliveryFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold text-text">
              <span>Total:</span>
              <span className="font-display">₦{total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-text">Delivery Address</h3>
          <p className="text-sm text-muted">{deliveryAddress}</p>
        </div>

        <div className="space-y-2">
        <h3 className="font-semibold text-text">Items</h3>
        {items.map((item) => (
          <p key={item.id} className="text-sm text-muted">
            {item.product.name}{item.selected_size ? ` · Size: ${item.selected_size}` : ""} · Qty {item.quantity}
          </p>
        ))}
        </div>

        <PaymentButtons
          orderId={orderId}
          email={user?.email ?? ""}
          amount={total}
          customerName={fullName}
          customerPhone={user?.phone}
        />

        <Button
          type="button"
          onClick={() => setOrderId(null)}
          variant="outline"
          className="w-full"
        >
          Back to Form
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger-text">
          {error}
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
          onChange={(e) => setFullName(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text">
          Delivery Address
        </label>
        <Input
          placeholder="Enter your delivery address"
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          disabled={isLoading}
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
            <span>Delivery:</span>
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
        disabled={isLoading || items.length === 0 || !user?.email}
        className="w-full"
      >
        {isLoading ? <Spinner /> : "Proceed to Payment"}
      </Button>
    </form>
  );
}
