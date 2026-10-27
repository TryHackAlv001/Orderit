"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { openPaystackBlankTab, usePaystackPaymentTab } from "@/lib/paystack-payment-tab";

interface PaymentButtonsProps {
  items: {
    productId: string;
    quantity: number;
    variantId: string | null;
    expectedPrice: number;
    selectedSize: string | null;
    selectedColor: string | null;
  }[];
  addressId: string;
  addressConfirmed: boolean;
  email: string;
  customerName?: string;
  customerPhone?: string;
}

type PaymentGateway = "paystack" | "flutterwave" | null;
const CHECKOUT_ATTEMPT_KEY = "order-checkout-attempt";

interface CheckoutAttempt {
  fingerprint: string;
  idempotencyKey: string;
  orderId?: string;
}

export function PaymentButtons({
  items,
  addressId,
  addressConfirmed,
  email,
  customerName,
  customerPhone,
}: PaymentButtonsProps) {
  const [loading, setLoading] = useState<PaymentGateway>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const {
    pendingPayment,
    paymentError,
    statusMessage,
    startPayment,
    reopenPaymentTab,
    checkPaymentNow,
    cancelWaiting,
  } = usePaystackPaymentTab();

  const createOrder = async () => {
    if (!addressId || !addressConfirmed) {
      throw new Error("Confirm a delivery address before continuing to payment.");
    }
    if (orderId) return orderId;

    const fingerprint = JSON.stringify({ items, addressId, email });
    let attempt: CheckoutAttempt;
    try {
      const savedAttempt = sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY);
      const parsed = savedAttempt ? JSON.parse(savedAttempt) as CheckoutAttempt : null;
      attempt = parsed?.fingerprint === fingerprint
        ? parsed
        : { fingerprint, idempotencyKey: window.crypto.randomUUID() };
    } catch {
      attempt = { fingerprint, idempotencyKey: window.crypto.randomUUID() };
    }
    if (attempt.orderId) {
      setOrderId(attempt.orderId);
      return attempt.orderId;
    }
    sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(attempt));

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        addressId,
        addressConfirmed,
        email,
        idempotencyKey: attempt.idempotencyKey,
      }),
    });
    const data = await response.json();
    const createdOrderId = typeof data.orderId === "string" ? data.orderId : null;
    if (!response.ok || !createdOrderId) {
      throw new Error(data.error || "Unable to create seller order.");
    }
    setOrderId(createdOrderId);
    sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify({ ...attempt, orderId: createdOrderId }));
    return createdOrderId;
  };

  const handlePaystackPayment = () => {
    const paymentTab = openPaystackBlankTab();
    setLoading("paystack");
    setError(null);

    void (async () => {
      try {
        const sellerOrderId = await createOrder();
        await startPayment(sellerOrderId, paymentTab);
      } catch (err) {
        if (paymentTab && !paymentTab.closed) paymentTab.close();
        setError(err instanceof Error ? err.message : "Payment initialization failed");
      } finally {
        setLoading(null);
      }
    })();
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
    <div className="space-y-3" data-payment-in-progress={loading !== null || pendingPayment !== null ? "true" : undefined}>
      {(error || paymentError) && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger-text">
          {error || paymentError}
        </div>
      )}

      {pendingPayment && (
        <section className="space-y-3 rounded-md border border-border bg-surface p-4" aria-live="polite">
          <p className="font-medium text-text">Complete your payment in the other tab</p>
          {statusMessage && <p className="text-sm text-muted">{statusMessage}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={reopenPaymentTab}>Reopen payment tab</Button>
            <Button type="button" size="sm" variant="outline" onClick={checkPaymentNow}>I&apos;ve paid (check status)</Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelWaiting}>Cancel</Button>
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          onClick={handlePaystackPayment}
          disabled={!addressConfirmed || !addressId || loading !== null || pendingPayment !== null}
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
          disabled={!addressConfirmed || !addressId || loading !== null || pendingPayment !== null}
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
