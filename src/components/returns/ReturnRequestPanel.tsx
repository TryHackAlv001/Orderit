"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ReturnTrackingTimeline, type ReturnStatusEvent } from "@/components/returns/ReturnTrackingTimeline";

interface ReturnableItem {
  id: string;
  product_name: string;
  quantity: number;
  price_at_purchase: number;
}

export interface ReturnRequestView {
  id: string;
  order_id: string;
  status: string;
  reason: string;
  note: string | null;
  photo_url: string | null;
  refund_amount: number;
  created_at: string;
  return_request_items: {
    id: string;
    order_item_id: string;
    quantity: number;
    order_item?: { product_name: string } | { product_name: string }[] | null;
  }[];
  return_status_history: ReturnStatusEvent[];
}

const reasons = [
  ["damaged", "Item arrived damaged"],
  ["not_as_described", "Not as described"],
  ["wrong_item", "Wrong item received"],
  ["missing_parts", "Missing parts"],
  ["changed_mind", "Changed my mind"],
  ["other", "Other"],
];

const reasonLabels = Object.fromEntries(reasons);

export function ReturnRequestPanel({
  orderId,
  orderStatus,
  createdAt,
  deliveredAt,
  returnWindowDays,
  policyError,
  returnsError,
  items,
  existingReturns,
}: {
  orderId: string;
  orderStatus: string;
  createdAt: string;
  deliveredAt: string | null;
  returnWindowDays: number;
  policyError?: string | null;
  returnsError?: string | null;
  items: ReturnableItem[];
  existingReturns: ReturnRequestView[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submittedIds = useMemo(() => new Set(existingReturns
    .filter((returnRequest) => returnRequest.status !== "rejected")
    .flatMap((returnRequest) => returnRequest.return_request_items.map((item) => item.order_item_id))),
  [existingReturns]);
  const availableItems = items.filter((item) => !submittedIds.has(item.id));
  const deliveryDate = new Date(deliveredAt ?? createdAt);
  const returnExpiresAt = new Date(deliveryDate.getTime() + returnWindowDays * 24 * 60 * 60 * 1000);
  const canRequest = orderStatus === "delivered" && returnWindowDays > 0 && Date.now() <= returnExpiresAt.getTime();

  const toggleItem = (id: string) => {
    setSelectedItems((current) => current.includes(id)
      ? current.filter((itemId) => itemId !== id)
      : [...current, id]);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!selectedItems.length) {
      setError("Select at least one item.");
      return;
    }
    if (!reason) {
      setError("Choose a return reason.");
      return;
    }
    if (note.trim().length > 2000) {
      setError("Note must be 2000 characters or fewer.");
      return;
    }

    setLoading(true);
    try {
      let photoUrl: string | undefined;
      if (photo) {
        const formData = new FormData();
        formData.append("file", photo);
        const uploadResponse = await fetch("/api/returns/upload", { method: "POST", body: formData });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadResult.error || "Unable to upload photo.");
        photoUrl = uploadResult.photoUrl;
      }

      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          itemIds: selectedItems,
          reason,
          note: note.trim(),
          photoUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to submit return request.");
      setSuccess(true);
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit return request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Returns</h2>
          <p className="mt-1 text-sm text-muted">
            {canRequest
              ? `Eligible for return until ${returnExpiresAt.toLocaleDateString()}.`
              : "Return requests are available for delivered orders during the return window."}
          </p>
        </div>
        {canRequest && availableItems.length > 0 && (
          <button type="button" onClick={() => setOpen((current) => !current)}
            className="rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent-text hover:bg-accent/10">
            {open ? "Close request" : "Request return"}
          </button>
        )}
      </div>

      {success && <p role="status" className="mt-4 rounded-lg bg-accent/10 p-3 text-sm text-accent-text">Return request submitted.</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger-text">{error}</p>}
      {(policyError || returnsError) && (
        <p role="alert" className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger-text">
          Unable to load return details: {policyError || returnsError}
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="mt-5 space-y-4 rounded-lg bg-bg p-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-text">Choose item(s)</legend>
            {availableItems.map((item) => (
              <label key={item.id} className="flex items-center gap-3 rounded-lg bg-surface p-3 text-sm">
                <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleItem(item.id)} />
                <span className="flex-1">{item.product_name} · Qty {item.quantity}</span>
              </label>
            ))}
          </fieldset>
          <label className="block space-y-2 text-sm font-medium text-text">
            <span>Reason</span>
            <select className="w-full rounded-lg border border-border bg-surface px-3 py-2.5" value={reason} onChange={(event) => setReason(event.target.value)} required>
              <option value="">Select a reason</option>
              {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-text">
            <span>Note (optional)</span>
            <textarea className="w-full rounded-lg border border-border bg-surface px-3 py-2.5" rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <label className="block space-y-2 text-sm font-medium text-text">
            <span>Photo (optional, JPG/PNG/WEBP up to 5MB)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" disabled={loading} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-on disabled:opacity-60">
            {loading ? "Submitting…" : "Submit return request"}
          </button>
        </form>
      )}

      {existingReturns.length > 0 ? (
        <div className="mt-5 space-y-4">
          {existingReturns.map((returnRequest) => (
            <article key={returnRequest.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-text">Return {returnRequest.id.slice(0, 8)}</p>
                  <p className="mt-1 text-sm text-muted">
                    {(reasonLabels[returnRequest.reason] as string) ?? returnRequest.reason} · Refund: ₦{Number(returnRequest.refund_amount).toLocaleString()}
                  </p>
                </div>
                {returnRequest.photo_url && (
                  <a href={returnRequest.photo_url} target="_blank" rel="noreferrer" className="text-sm text-accent-text underline">View photo</a>
                )}
              </div>
              <ReturnTrackingTimeline
                returnRequestId={returnRequest.id}
                status={returnRequest.status}
                initialHistory={returnRequest.return_status_history ?? []}
              />
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">No return requests for this order.</p>
      )}
      {canRequest && availableItems.length === 0 && <p className="mt-4 text-sm text-muted">All items already have an active return request.</p>}
    </section>
  );
}
