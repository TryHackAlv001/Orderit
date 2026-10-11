"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

const nextStatuses: Record<string, { value: string; label: string }[]> = {
  pending: [{ value: "confirmed", label: "Confirmed" }],
  confirmed: [{ value: "preparing", label: "Preparing" }],
  preparing: [
    { value: "shipped", label: "Shipped" },
    { value: "out_for_delivery", label: "Out for delivery" },
  ],
  shipped: [{ value: "out_for_delivery", label: "Out for delivery" }],
  out_for_delivery: [{ value: "delivered", label: "Delivered" }],
};

interface VendorOrderActionsProps {
  orderId: string;
  status: string;
  buyerId?: string;
  onStatusChange?: (newStatus: string) => void;
}

export function VendorOrderActions({ orderId, status, buyerId, onStatusChange }: VendorOrderActionsProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [trackingNote, setTrackingNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choices = useMemo(() => nextStatuses[currentStatus] ?? [], [currentStatus]);
  const nextStatus = choices.length > 1 ? selectedStatus || choices[0].value : choices[0]?.value;

  const updateStatus = async () => {
    if (!nextStatus) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/vendor/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, note: trackingNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update order status.");
      setCurrentStatus(result.order.status);
      setTrackingNote("");
      onStatusChange?.(result.order.status);
      toast.success("Order status updated.");
      router.refresh();
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Unable to update order status.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger-text">{error}</p>}
      {choices.length > 0 ? (
        <div className="space-y-3">
          {choices.length > 1 && (
            <label className="block space-y-2 text-sm font-medium text-text">
              <span>Next status</span>
              <select value={nextStatus} onChange={(event) => setSelectedStatus(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5">
                {choices.map((choice) => <option value={choice.value} key={choice.value}>{choice.label}</option>)}
              </select>
            </label>
          )}
          <label className="block space-y-2 text-sm font-medium text-text">
            <span>Tracking note (optional)</span>
            <textarea value={trackingNote} onChange={(event) => setTrackingNote(event.target.value)}
              maxLength={2000} rows={2} placeholder="Add useful delivery details for the buyer"
              className="w-full rounded-lg border border-border px-3 py-2.5" />
          </label>
          <Button onClick={updateStatus} disabled={loading || !nextStatus}
            className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60">
            <Truck className="mr-2 h-4 w-4" />
            {loading ? "Updating…" : `Update to ${choices.find((item) => item.value === nextStatus)?.label}`}
          </Button>
        </div>
      ) : (
        <p className={`text-sm font-medium ${currentStatus === "cancelled" ? "text-danger-text" : "text-accent-text"}`}>
          {currentStatus === "cancelled" ? "Order cancelled" : "Order completed"}
        </p>
      )}
      {buyerId && (
        <Button onClick={() => router.push(`/messages?with=${buyerId}`)}
        variant="outline" className="rounded-md px-5 py-3 text-sm font-semibold">
          <MessageCircle className="mr-2 h-4 w-4" /> Message Buyer
        </Button>
      )}
    </div>
  );
}
