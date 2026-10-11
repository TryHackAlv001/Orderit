"use client";

import { useCallback, useEffect, useState } from "react";
import { ReturnTrackingTimeline, type ReturnStatusEvent } from "@/components/returns/ReturnTrackingTimeline";

interface ManagedReturn {
  id: string;
  order_id: string;
  buyer_id: string;
  status: string;
  reason: string;
  note: string | null;
  tracking_note: string | null;
  photo_url: string | null;
  refund_amount: number;
  created_at: string;
  return_request_items: {
    id: string;
    quantity: number;
    order_item?: { product_name: string; product_image: string | null; price_at_purchase: number } | null;
  }[];
  return_status_history: ReturnStatusEvent[];
}

const transitions: Record<string, { status: string; label: string }[]> = {
  requested: [
    { status: "approved", label: "Approve" },
    { status: "rejected", label: "Reject" },
  ],
  approved: [{ status: "pickup_scheduled", label: "Schedule pickup" }],
  pickup_scheduled: [{ status: "picked_up", label: "Mark picked up" }],
  picked_up: [{ status: "received_by_vendor", label: "Mark received" }],
  received_by_vendor: [{ status: "refunded", label: "Refund to buyer wallet" }],
};

const reasonLabels: Record<string, string> = {
  damaged: "Item arrived damaged",
  not_as_described: "Not as described",
  wrong_item: "Wrong item received",
  missing_parts: "Missing parts",
  changed_mind: "Changed my mind",
  other: "Other",
};

export function ReturnManagement() {
  const [returns, setReturns] = useState<ManagedReturn[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/vendor/returns");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load return requests.");
      setReturns(result.returns ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load return requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReturns(); }, [loadReturns]);

  const updateReturn = async (returnRequest: ManagedReturn, status: string) => {
    setSavingId(returnRequest.id);
    setError(null);
    try {
      const response = await fetch(`/api/vendor/returns/${returnRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: notes[returnRequest.id] ?? "" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update return request.");
      await loadReturns();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update return request.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">Loading return requests…</div>;

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger-text">{error}</p>}
      {returns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg p-12 text-center">
          <h2 className="text-lg font-semibold text-text">No return requests</h2>
          <p className="mt-2 text-sm text-muted">New buyer requests will appear here.</p>
        </div>
      ) : returns.map((returnRequest) => (
        <article key={returnRequest.id} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-text">Return {returnRequest.id.slice(0, 8)}</p>
              <p className="mt-1 text-sm text-muted">
                Order {returnRequest.order_id.slice(0, 8)} · Buyer {returnRequest.buyer_id.slice(0, 8)}
              </p>
              <p className="mt-2 text-sm text-text">{reasonLabels[returnRequest.reason] ?? returnRequest.reason}</p>
            </div>
            <span className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-semibold capitalize text-text">
              {returnRequest.status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text">Items</h3>
              {returnRequest.return_request_items.map((item) => (
                <p key={item.id} className="text-sm text-text">
                  {item.order_item?.product_name ?? "Order item"} · Qty {item.quantity}
                </p>
              ))}
              {returnRequest.note && <p className="text-sm text-muted">Buyer note: {returnRequest.note}</p>}
              {returnRequest.photo_url && (
                <a href={returnRequest.photo_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-accent-text underline">View attached photo</a>
              )}
              <p className="text-sm font-semibold text-text">Refund amount: ₦{Number(returnRequest.refund_amount).toLocaleString()}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-text">Return timeline</h3>
              <ReturnTrackingTimeline
                returnRequestId={returnRequest.id}
                status={returnRequest.status}
                initialHistory={returnRequest.return_status_history ?? []}
              />
            </div>
          </div>

          {(transitions[returnRequest.status]?.length ?? 0) > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <label className="mb-3 block space-y-2 text-sm text-text">
                <span>Tracking note (optional)</span>
                <textarea value={notes[returnRequest.id] ?? ""} maxLength={2000} rows={2}
                  onChange={(event) => setNotes((current) => ({ ...current, [returnRequest.id]: event.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2" />
              </label>
              <div className="flex flex-wrap gap-2">
                {transitions[returnRequest.status].map((transition) => (
                  <button key={transition.status} type="button" disabled={savingId === returnRequest.id}
                    onClick={() => void updateReturn(returnRequest, transition.status)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                      transition.status === "rejected" ? "border border-danger text-danger-text" : "bg-accent text-accent-on"
                    }`}>
                    {savingId === returnRequest.id ? "Updating…" : transition.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
