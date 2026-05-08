"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Check, Truck, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface VendorOrderActionsProps {
  orderId: string;
  status: string;
  buyerId: string;
}

export function VendorOrderActions({ orderId, status, buyerId }: VendorOrderActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeAction = async (url: string, body?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to update order status");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const confirmOrder = () => executeAction(`/api/vendor/orders/${orderId}/confirm`);

  const shipOrder = () => {
    const trackingNumber = window.prompt("Enter tracking number:", "");
    if (!trackingNumber) return;
    executeAction(`/api/vendor/orders/${orderId}/ship`, { tracking_number: trackingNumber });
  };

  const deliverOrder = () => executeAction(`/api/vendor/orders/${orderId}/deliver`);

  const cancelOrder = () => {
    const reason = window.prompt("Enter cancel reason:", "");
    if (!reason) return;
    executeAction(`/api/vendor/orders/${orderId}/cancel`, { reason });
  };

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">Actions</p>
      <div className="flex flex-wrap gap-3">
        {status === "pending" && (
          <Button onClick={confirmOrder} disabled={loading} className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
            <Check className="mr-2 h-4 w-4" /> Confirm Order
          </Button>
        )}
        {status === "confirmed" && (
          <Button onClick={shipOrder} disabled={loading} className="rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700">
            <Truck className="mr-2 h-4 w-4" /> Mark as Shipped
          </Button>
        )}
        {status === "shipped" && (
          <Button onClick={deliverOrder} disabled={loading} className="rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">
            <ShieldCheck className="mr-2 h-4 w-4" /> Mark as Delivered
          </Button>
        )}
        <Button onClick={cancelOrder} disabled={loading} className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700">
          <X className="mr-2 h-4 w-4" /> Cancel Order
        </Button>
        <Button
          onClick={() => router.push(`/main/messages?buyerId=${buyerId}`)}
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <MessageCircle className="mr-2 h-4 w-4" /> Message Buyer
        </Button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
