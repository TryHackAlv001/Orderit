'use client';
import { useCartStore } from '@/store/cartStore';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { MARKETPLACE_ROUTE } from '@/constants';
import { waitForOriginalPaymentTab } from '@/lib/paystack-payment-tab';

type VerificationStatus = 'loading' | 'success' | 'failed' | 'received';

export default function CheckoutVerifyPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<VerificationStatus>('loading');
  const removeProducts = useCartStore((state) => state.removeProducts);
  const gateway = searchParams.get('gateway');
  const reference = searchParams.get('reference');
  const orderId = searchParams.get('orderId');
  const transactionId = searchParams.get('transaction_id');

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;

    const verify = async () => {
      try {
        if (gateway === 'paystack' && reference) {
          const res = await fetch(`/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}`);
          const data = await res.json();
          if (data.success) {
            removeProducts(data.productIds ?? []);
            if (orderId) {
              try {
                const attempt = JSON.parse(sessionStorage.getItem("order-checkout-attempt") ?? "null");
                if (attempt?.orderId === orderId) sessionStorage.removeItem("order-checkout-attempt");
              } catch {
                sessionStorage.removeItem("order-checkout-attempt");
              }
            }
            setStatus('success');
          } else {
            setStatus('failed');
          }
        } else if (gateway === 'flutterwave') {
          const res = transactionId
            ? await fetch(`/api/payments/flutterwave/verify?transaction_id=${encodeURIComponent(transactionId)}`)
            : null;
          if (!res) {
            setStatus('failed');
            return;
          }
          const data = await res.json();
          if (data.verified) {
            removeProducts(data.productIds ?? []);
            setStatus('success');
          } else {
            setStatus('failed');
          }
        } else {
          setStatus('failed');
        }
      } catch {
        setStatus('failed');
      }
    };

    const begin = async () => {
      if (gateway === 'paystack' && reference && orderId) {
        const acknowledged = await waitForOriginalPaymentTab(
          { orderId, reference },
          controller.signal,
        );
        if (disposed) return;
        if (acknowledged) {
          setStatus('received');
          window.close();
          return;
        }
      }
      if (!disposed) await verify();
    };

    void begin();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [gateway, orderId, reference, removeProducts, transactionId]);

  return (
    <div className="flex min-h-[60svh] min-w-0 items-center justify-center px-0 pb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+1rem)] md:px-4 md:pb-4">
      <div className="min-w-0 max-w-md space-y-4 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-accent-text mx-auto" />
            <h1 className="text-2xl font-semibold text-text">Verifying payment...</h1>
            <p className="text-muted">Please wait while we confirm your payment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-text mx-auto" />
            <h1 className="text-xl font-semibold text-text sm:text-2xl">Payment Successful!</h1>
            <p className="text-muted">This seller order is confirmed. Other sellers&apos; items remain in your cart until paid.</p>
            <div className="mt-4 flex w-full flex-col justify-center gap-2 sm:flex-row sm:gap-3">
              <Link replace href="/buyer/orders" className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-6 py-2 text-sm font-medium text-accent-on transition-colors duration-200 hover:brightness-95 sm:w-auto">
                View my orders
              </Link>
              <Link replace href={MARKETPLACE_ROUTE} className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-6 py-2 text-sm font-medium text-text transition-colors duration-200 hover:bg-surface-raised sm:w-auto">
                Back to marketplace
              </Link>
            </div>
          </>
        )}

        {status === 'received' && (
          <>
            <CheckCircle className="mx-auto h-16 w-16 text-text" />
            <h1 className="text-2xl font-semibold text-text">Payment received. Return to your order tab</h1>
            <p className="text-muted">Your order tab is checking the payment status.</p>
            {orderId && (
              <Link
                href={`/buyer/orders/${encodeURIComponent(orderId)}`}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-6 py-2 text-sm font-medium text-text transition-colors duration-200 hover:bg-surface-raised"
              >
                Return to your order
              </Link>
            )}
          </>
        )}

        {status === 'failed' && (
          <>
            <XCircle className="h-16 w-16 text-danger-text mx-auto" />
            <h1 className="text-2xl font-semibold text-text">Payment Failed</h1>
            <p className="text-muted">Something went wrong with your payment. Please try again.</p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row sm:gap-3">
              <Link href="/checkout" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-6 py-2 text-sm font-medium text-text transition-colors duration-200 hover:bg-surface-raised">
                Try Again
              </Link>
              <Link href="/marketplace" className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-6 py-2 text-sm font-medium text-accent-on transition-colors duration-200 hover:brightness-95">
                Back to Marketplace
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
