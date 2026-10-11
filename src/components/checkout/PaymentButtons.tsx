"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface PaymentButtonsProps {
  orderId: string;
  email: string;
  amount: number;
  customerName?: string;
  customerPhone?: string;
}

type PaymentGateway = "paystack" | "flutterwave" | null;

export function PaymentButtons({
  orderId,
  email,
  amount,
  customerName,
  customerPhone,
}: PaymentButtonsProps) {
  const [loading, setLoading] = useState<PaymentGateway>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePaystackPayment = async () => {
    setLoading("paystack");
    setError(null);

    try {
      // Call Paystack initialize API
      const response = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          email,
          amount, // in NGN
        }),
      });

      const data = await response.json();

      if (!data.authorization_url) {
        throw new Error(data.error || "Failed to initialize Paystack payment");
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
      // Call Flutterwave initialize API
      const response = await fetch("/api/payments/flutterwave/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          email,
          amount, // in NGN
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
    <div className="space-y-3">
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
