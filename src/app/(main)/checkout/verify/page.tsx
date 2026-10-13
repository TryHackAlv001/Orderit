'use client';
import { useCartStore } from '@/store/cartStore';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutVerifyPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const removeProducts = useCartStore((state) => state.removeProducts);

  useEffect(() => {
    const verify = async () => {
      const gateway = searchParams.get('gateway');
      const reference = searchParams.get('reference');

      try {
        if (gateway === 'paystack' && reference) {
          const res = await fetch(`/api/payments/paystack/verify?reference=${encodeURIComponent(reference)}`);
          const data = await res.json();
          if (data.success) {
            removeProducts(data.productIds ?? []);
            setStatus('success');
          } else {
            setStatus('failed');
          }
        } else if (gateway === 'flutterwave') {
          const transactionId = searchParams.get('transaction_id');
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

    verify();
  }, [searchParams, removeProducts]);

  return (
    <div className="flex min-h-[60svh] min-w-0 items-center justify-center px-0 md:px-4">
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
            <h1 className="text-2xl font-semibold text-text">Payment Successful! 🎉</h1>
            <p className="text-muted">This seller order is confirmed. Other sellers&apos; items remain in your cart until paid.</p>
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row sm:gap-3">
              <Link href="/cart" className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-6 py-2 text-sm font-medium text-accent-on transition-colors duration-200 hover:brightness-95">
                Continue Checkout
              </Link>
              <Link href="/buyer/orders" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-6 py-2 text-sm font-medium text-text transition-colors duration-200 hover:bg-surface-raised">
                View My Orders
              </Link>
            </div>
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
