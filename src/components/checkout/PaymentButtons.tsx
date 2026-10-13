"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface PaymentButtonsProps {
  items: {
    productId: string;
    quantity: number;
    variantId: string | null;
    expectedPrice: number;
    selectedSize: string | null;
    selectedColor: string | null;
  }[];
  deliveryAddress: string;
  email: string;
  customerName?: string;
  customerPhone?: string;
}

type PaymentGateway = "paystack" | "flutterwave" | null;

export function PaymentButtons({
  items,
  deliveryAddress,
  email,
  customerName,
  customerPhone,
}: PaymentButtonsProps) {
  const [loading, setLoading] = useState<PaymentGateway>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const createOrder = async () => {
    if (orderId) return orderId;

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        deliveryAddress,
        customerName,
        customerPhone,
        email,
      }),
    });
    const data = await response.json();
    const createdOrderId = typeof data.orderId === "string" ? data.orderId : null;
    if (!response.ok || !createdOrderId) {
      throw new Error(data.error || "Unable to create seller order.");
    }
    setOrderId(createdOrderId);
    return createdOrderId;
  };

  const handlePaystackPayment = async () => {
    setLoading("paystack");
    setError(null);

    try {
      const sellerOrderId = await createOrder();
      // Call Paystack initialize API
      const response = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: sellerOrderId }),
      });

      const data: { authorization_url?: unknown; error?: unknown; message?: unknown } =
        await response.json();

      if (!response.ok || typeof data.authorization_url !== "string") {
        const errorMessage =
          typeof data.error === "string"
            ? data.error
            : typeof data.message === "string"
              ? data.message
              : "Failed to initialize Paystack payment";
        throw new Error(errorMessage);
      }

      // Redirect to Paystack payment page
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment initialization failed");
      setLoading(null);
    }
  };

  const handleFlutterwavePayment = async () => {
    setLoading("flutterwave");
    setError(null);

    try {
      const sellerOrderId = await createOrder();
      // Call Flutterwave initialize API
      const response = await fetch("/api/payments/flutterwave/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: sellerOrderId,
          customerName,
          customerPhone,
        }),
      });

      const data = await response.json();

      if (!data.status || !data.data?.link) {
        throw new Error(data.error || "Failed to initialize Flutterwave payment");
      }

      // Redirect to Flutterwave payment page
      window.location.href = data.data.link;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment initialization failed");
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3" data-payment-in-progress={loading !== null ? "true" : undefined}>
      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger-text">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          onClick={handlePaystackPayment}
          disabled={loading !== null}
          className="transition-colors duration-200"
        >
          {loading === "paystack" ? (
            <>
              <Spinner />
              Processing...
            </>
          ) : (
            "Pay with Paystack"
          )}
        </Button>

        <Button
          type="button"
          onClick={handleFlutterwavePayment}
          disabled={loading !== null}
          variant="outline"
        >
          {loading === "flutterwave" ? (
            <>
              <Spinner />
              Processing...
            </>
          ) : (
            "Pay with Flutterwave"
          )}
        </Button>
      </div>
    </div>
  );
}
