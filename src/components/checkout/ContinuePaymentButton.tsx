"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { openPaystackBlankTab, usePaystackPaymentTab } from "@/lib/paystack-payment-tab";

export function ContinuePaymentButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const {
    pendingPayment,
    paymentError,
    statusMessage,
    startPayment,
    reopenPaymentTab,
    checkPaymentNow,
    cancelWaiting,
  } = usePaystackPaymentTab();

  const continuePayment = () => {
    const paymentTab = openPaystackBlankTab();
    setLoading(true);
    void startPayment(orderId, paymentTab).finally(() => setLoading(false));
  };

  return (
    <div className="space-y-3">
      {pendingPayment ? (
        <section className="space-y-3 rounded-md border border-border bg-surface p-4" aria-live="polite">
          <p className="font-medium text-text">Complete your payment in the other tab</p>
          {statusMessage && <p className="text-sm text-muted">{statusMessage}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={reopenPaymentTab}>Reopen payment tab</Button>
            <Button type="button" size="sm" variant="outline" onClick={checkPaymentNow}>I&apos;ve paid (check status)</Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelWaiting}>Cancel</Button>
          </div>
        </section>
      ) : (
        <Button type="button" onClick={continuePayment} disabled={loading}>
        {loading ? <><Spinner /> Continuing...</> : "Continue payment"}
        </Button>
      )}
      {paymentError && <p className="text-sm text-danger-text" role="alert">{paymentError}</p>}
    </div>
  );
}