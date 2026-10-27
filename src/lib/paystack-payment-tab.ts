"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PAYMENT_CHANNEL = "tradeloft-payment";
const PAYMENT_POLL_INTERVAL_MS = 5_000;
const PAYMENT_POLL_TIMEOUT_MS = 15 * 60 * 1_000;

interface PaymentHandoff {
  orderId: string;
  reference: string;
}

interface PendingPayment extends PaymentHandoff {
  authorizationUrl: string;
  popup: Window | null;
}

interface PaymentStatusResponse {
  items?: Array<{ order_id?: unknown; order_status?: unknown }>;
}

function isExpectedPaymentMessage(
  value: unknown,
  expected: PaymentHandoff,
): value is PaymentHandoff {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return message.orderId === expected.orderId && message.reference === expected.reference;
}

function isAcknowledgement(value: unknown, expected: PaymentHandoff): boolean {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return message.type === "ack" && isExpectedPaymentMessage(message, expected);
}

async function claimVerification(expected: PaymentHandoff): Promise<boolean> {
  const key = `tradeloft-payment-verify:${expected.orderId}:${expected.reference}`;
  const claim = () => {
    try {
      const claimedAt = Number(window.localStorage.getItem(key));
      if (Number.isFinite(claimedAt) && Date.now() - claimedAt < PAYMENT_POLL_TIMEOUT_MS) {
        return false;
      }
      window.localStorage.setItem(key, String(Date.now()));
    } catch {
      return true;
    }
    return true;
  };

  if (navigator.locks?.request) {
    try {
      return await navigator.locks.request(
        key,
        { mode: "exclusive", ifAvailable: true },
        (lock) => lock ? claim() : false,
      );
    } catch {
      return claim();
    }
  }
  return claim();
}

export function openPaystackBlankTab(): Window | null {
  try {
    return window.open("", "_blank");
  } catch {
    return null;
  }
}

export function buildPaymentVerificationUrl({ orderId, reference }: PaymentHandoff): string {
  return `/checkout/verify?gateway=paystack&orderId=${encodeURIComponent(orderId)}&reference=${encodeURIComponent(reference)}`;
}

export function waitForOriginalPaymentTab(
  expected: PaymentHandoff,
  signal: AbortSignal,
): Promise<boolean> {
  if (typeof BroadcastChannel === "undefined") return Promise.resolve(false);

  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(PAYMENT_CHANNEL);
  } catch {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (acknowledged: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      signal.removeEventListener("abort", abortHandler);
      channel.removeEventListener("message", messageHandler);
      channel.close();
      resolve(acknowledged);
    };
    const abortHandler = () => finish(false);
    const messageHandler = (event: MessageEvent<unknown>) => {
      if (isAcknowledgement(event.data, expected)) finish(true);
    };
    const timeoutId = window.setTimeout(() => finish(false), 2_000);

    channel.addEventListener("message", messageHandler);
    signal.addEventListener("abort", abortHandler, { once: true });
    if (signal.aborted) {
      finish(false);
      return;
    }
    channel.postMessage({ orderId: expected.orderId, reference: expected.reference });
  });
}

export function usePaystackPaymentTab() {
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pendingRef = useRef<PendingPayment | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<number | null>(null);
  const pollingRef = useRef(false);

  const updatePending = useCallback((payment: PendingPayment | null) => {
    pendingRef.current = payment;
    setPendingPayment(payment);
  }, []);

  const cleanup = useCallback((closePopup: boolean) => {
    if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current);
    if (timeoutTimerRef.current !== null) window.clearTimeout(timeoutTimerRef.current);
    pollTimerRef.current = null;
    timeoutTimerRef.current = null;
    pollingRef.current = false;
    channelRef.current?.close();
    channelRef.current = null;
    const popup = pendingRef.current?.popup;
    if (closePopup && popup && !popup.closed) popup.close();
  }, []);

  const finishPayment = useCallback((orderId: string) => {
    cleanup(true);
    updatePending(null);
    window.location.assign(`/buyer/orders/${encodeURIComponent(orderId)}`);
  }, [cleanup, updatePending]);

  const checkOrderStatus = useCallback(async (orderId: string): Promise<boolean> => {
    if (pollingRef.current) return false;
    pollingRef.current = true;
    try {
      const response = await fetch("/api/buyer/orders/items?page=1", { cache: "no-store" });
      if (!response.ok) return false;
      const data = await response.json() as PaymentStatusResponse;
      const paidStatuses = new Set(["confirmed", "preparing", "shipped", "out_for_delivery", "delivered"]);
      return (data.items ?? []).some((item) =>
        item.order_id === orderId &&
        typeof item.order_status === "string" &&
        paidStatuses.has(item.order_status)
      );
    } catch {
      return false;
    } finally {
      pollingRef.current = false;
    }
  }, []);

  const startPayment = useCallback(async (orderId: string, popup: Window | null) => {
    setPaymentError(null);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/payments/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json() as {
        authorization_url?: unknown;
        reference?: unknown;
        success?: unknown;
        error?: unknown;
      };

      if (response.ok && result.success === true) {
        if (popup && !popup.closed) popup.close();
        finishPayment(orderId);
        return;
      }

      const authorizationUrl = typeof result.authorization_url === "string"
        ? result.authorization_url
        : null;
      const reference = typeof result.reference === "string" ? result.reference : null;
      if (authorizationUrl) {
        const parsedUrl = new URL(authorizationUrl);
        if (parsedUrl.protocol !== "https:") throw new Error("Paystack returned an invalid payment URL.");
        if (!response.ok || !reference) {
          if (popup && !popup.closed) popup.location.assign(authorizationUrl);
          else window.location.assign(authorizationUrl);
          return;
        }

        const payment: PendingPayment = { orderId, reference, authorizationUrl, popup };
        updatePending(payment);

        if (typeof BroadcastChannel !== "undefined") {
          try {
            const channel = new BroadcastChannel(PAYMENT_CHANNEL);
            channelRef.current = channel;
            channel.addEventListener("message", (event: MessageEvent<unknown>) => {
              const expected = pendingRef.current;
              if (!expected || !isExpectedPaymentMessage(event.data, expected)) return;
              channel.postMessage({
                type: "ack",
                orderId: expected.orderId,
                reference: expected.reference,
              });
              void claimVerification(expected).then((claimed) => {
                if (claimed) window.location.assign(buildPaymentVerificationUrl(expected));
              });
            });
          } catch {
            channelRef.current = null;
          }
        }

        pollTimerRef.current = window.setInterval(() => {
          void checkOrderStatus(orderId).then((isPaid) => {
            if (isPaid && pendingRef.current?.orderId === orderId) finishPayment(orderId);
          });
        }, PAYMENT_POLL_INTERVAL_MS);
        timeoutTimerRef.current = window.setTimeout(() => {
          if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setStatusMessage("We have not received payment confirmation yet.");
        }, PAYMENT_POLL_TIMEOUT_MS);

        if (!popup || popup.closed) {
          cleanup(false);
          updatePending(null);
          window.location.assign(authorizationUrl);
          return;
        }
        popup.location.assign(authorizationUrl);
        return;
      }

      throw new Error(typeof result.error === "string" ? result.error : "Unable to initialize Paystack payment.");
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      try {
        const fallbackResponse = await fetch("/api/payments/paystack/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const fallbackResult = await fallbackResponse.json() as {
          authorization_url?: unknown;
          success?: unknown;
        };
        if (fallbackResponse.ok && fallbackResult.success === true) {
          finishPayment(orderId);
          return;
        }
        if (fallbackResponse.ok && typeof fallbackResult.authorization_url === "string") {
          const fallbackUrl = new URL(fallbackResult.authorization_url);
          if (fallbackUrl.protocol === "https:") {
            window.location.assign(fallbackUrl.toString());
            return;
          }
        }
      } catch {
        // Keep the original error visible when same-tab recovery is unavailable.
      }
      setPaymentError(error instanceof Error ? error.message : "Unable to initialize Paystack payment.");
    }
  }, [checkOrderStatus, cleanup, finishPayment, updatePending]);

  const reopenPaymentTab = useCallback(() => {
    const payment = pendingRef.current;
    if (!payment) return;
    if (payment.popup && !payment.popup.closed) {
      payment.popup.focus();
      return;
    }
    const popup = window.open(payment.authorizationUrl, "_blank");
    if (!popup) setStatusMessage("Your browser blocked the payment tab. Allow popups or continue in this tab.");
    else updatePending({ ...payment, popup });
  }, [updatePending]);

  const checkPaymentNow = useCallback(async () => {
    const payment = pendingRef.current;
    if (!payment) return;
    setStatusMessage("Checking payment status...");
    if (await checkOrderStatus(payment.orderId)) {
      finishPayment(payment.orderId);
    } else if (pendingRef.current?.orderId === payment.orderId) {
      setStatusMessage("Payment is not confirmed yet. You can check again shortly.");
    }
  }, [checkOrderStatus, finishPayment]);

  const cancelWaiting = useCallback(() => {
    cleanup(true);
    updatePending(null);
    setStatusMessage(null);
  }, [cleanup, updatePending]);

  useEffect(() => () => cleanup(true), [cleanup]);

  return {
    pendingPayment,
    paymentError,
    statusMessage,
    startPayment,
    reopenPaymentTab,
    checkPaymentNow,
    cancelWaiting,
  };
}