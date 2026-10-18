"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Package,
  Phone,
  Truck,
} from "lucide-react";
import { ORDER_STATUS_LABELS } from "@/constants/order-status";
import { statusColor } from "@/lib/order-status";
import { OrderTimeline } from "@/components/order/OrderTimeline";

export interface TrackerHistoryEvent {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface TrackerItem {
  id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  selected_size: string | null;
  selected_color: string | null;
  quantity: number;
  price_at_purchase: number;
}

interface TrackerOrder {
  id: string;
  status: string;
  cancellation_reason: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking_note: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  estimated_delivery_at: string | null;
  vendor_id: string;
}

export function OrderTracker({
  order: initialOrder,
  item,
  history,
}: {
  order: TrackerOrder;
  item: TrackerItem;
  history: TrackerHistoryEvent[];
}) {
  const router = useRouter();
  const [order, setOrder] = useState(initialOrder);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const currentStatusRef = useRef(initialOrder.status);
  const confirmingRef = useRef(false);
  const confirmDeliveryButtonRef = useRef<HTMLButtonElement>(null);
  const cancelConfirmationButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationDialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!confirmDialogOpen) return;
    cancelConfirmationButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirmingRef.current) {
        event.preventDefault();
        setConfirmDialogOpen(false);
      } else if (event.key === "Tab") {
        const buttons = confirmationDialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        );
        if (!buttons?.length) return;
        event.preventDefault();
        const focusedIndex = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex = (focusedIndex + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length;
        buttons[nextIndex]?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (confirmDeliveryButtonRef.current?.isConnected) {
        confirmDeliveryButtonRef.current.focus();
      }
    };
  }, [confirmDialogOpen]);

  useEffect(() => {
    setOrder(initialOrder);
    currentStatusRef.current = initialOrder.status;
  }, [initialOrder]);

  const handleStatusChange = useCallback((status: string) => {
    if (currentStatusRef.current === status) return;
    currentStatusRef.current = status;
    setOrder((current) => ({ ...current, status }));
    router.refresh();
  }, [router]);

  const confirmDelivery = async () => {
    confirmingRef.current = true;
    setConfirming(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/buyer/orders/${encodeURIComponent(order.id)}/confirm-delivery`, {
        method: "POST",
      });
      const result = await response.json() as { error?: string; status?: string };
      if (!response.ok) throw new Error(result.error || "Delivery could not be confirmed.");
      currentStatusRef.current = result.status ?? "delivered";
      setOrder((current) => ({ ...current, status: result.status ?? "delivered" }));
      setConfirmDialogOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to confirm delivery:", error);
      setActionError(error instanceof Error ? error.message : "Delivery could not be confirmed.");
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  const copyTrackingNumber = async () => {
    const trackingNumber = order.tracking_number?.trim();
    if (!trackingNumber) return;
    setCopyMessage(null);
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopyMessage("Tracking number copied.");
    } catch (error) {
      console.error("Unable to copy tracking number:", error);
      setCopyMessage("Could not copy the tracking number. Please select it and copy it manually.");
    }
  };

  const canConfirmDelivery = order.status === "out_for_delivery";
  const canReportProblem = canConfirmDelivery || order.status === "delivered";
  const trackingNumber = order.tracking_number?.trim() ?? "";
  const whatsNext = getWhatsNext(order.status);

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl space-y-5 pb-6">
      <header className="min-w-0 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] items-center gap-4">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-bg">
            {item.product_image ? (
              <img src={item.product_image} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-8 w-8 text-muted" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="line-clamp-2 text-lg font-semibold text-text sm:text-xl" title={item.product_name}>
              {item.product_name}
            </h1>
            <p className="mt-1 truncate text-sm text-muted">
              Order #{order.id.slice(0, 8)}
            </p>
            <span className={`mt-2 inline-flex min-h-6 items-center rounded-full px-3 text-xs font-semibold ${statusColor(order.status)}`}>
              {ORDER_STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <p className="min-w-0 truncate text-muted" title={[item.selected_size && `Size: ${item.selected_size}`, item.selected_color && `Color: ${item.selected_color}`].filter(Boolean).join(" · ") || undefined}>
            {[item.selected_size && `Size: ${item.selected_size}`, item.selected_color && `Color: ${item.selected_color}`]
              .filter(Boolean)
              .join(" · ") || "Variant not recorded"}
          </p>
          <p className="text-muted">Quantity: {item.quantity}</p>
          <p className="font-semibold text-text">₦{Number(item.price_at_purchase).toLocaleString()}</p>
        </div>
      </header>

      <section className="min-w-0 space-y-3">
        <h2 className="text-lg font-semibold text-text">Delivery progress</h2>
        <p className="mt-1 text-sm text-muted">Follow your item from purchase to delivery.</p>
        <OrderTimeline
          key={order.id}
          status={order.status}
          orderId={order.id}
          history={history}
          cancellationReason={order.cancellation_reason}
          onStatusChange={handleStatusChange}
        />
        <p className="mt-4 rounded-lg bg-bg p-3 text-sm text-text">
          <span className="font-semibold">What&apos;s next:</span> {whatsNext}
        </p>
      </section>

      {order.status === "out_for_delivery" && (
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-accent-text" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-text">Delivery details</h2>
          </div>
          <dl className="mt-4 space-y-4 text-sm">
            {(order.rider_name || order.courier_name) && (
              <div className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
                <dt className="text-muted">{order.rider_name ? "Rider" : "Courier"}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-text" title={order.rider_name || order.courier_name || undefined}>
                  {order.rider_name || order.courier_name}
                </dd>
              </div>
            )}
            {order.tracking_note && !order.rider_name && !order.courier_name && (
              <div className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
                <dt className="text-muted">Pickup instructions</dt>
                <dd className="min-w-0 truncate text-right font-medium text-text" title={order.tracking_note}>
                  {order.tracking_note}
                </dd>
              </div>
            )}
            {trackingNumber && (
              <div className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-center gap-3">
                <dt className="text-muted">Tracking number</dt>
                <dd className="flex min-w-0 items-center justify-end gap-2">
                  <span className="min-w-0 truncate text-right font-medium text-text" title={trackingNumber}>
                    {trackingNumber}
                  </span>
                  <button
                    type="button"
                    onClick={copyTrackingNumber}
                    aria-label="Copy tracking number"
                    className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-border text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {copyMessage === "Tracking number copied." ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </dd>
              </div>
            )}
            {order.tracking_url && (
              <div className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
                <dt className="text-muted">Tracking link</dt>
                <dd className="min-w-0 text-right">
                  <a
                    href={order.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 max-w-full items-center justify-end gap-2 text-accent-text underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate">Track with courier</span>
                    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                  </a>
                </dd>
              </div>
            )}
            {order.estimated_delivery_at && (
              <div className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
                <dt className="text-muted">{order.tracking_note && !order.rider_name && !order.courier_name ? "Pickup-ready date" : "Estimated delivery"}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-text">
                  {new Date(order.estimated_delivery_at).toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    ...(!order.rider_name ? { timeZone: "UTC" } : {}),
                  })}
                </dd>
              </div>
            )}
            {order.rider_phone && (
              <div className="pt-1">
                <a
                  href={`tel:${order.rider_phone}`}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-accent px-4 text-sm font-semibold text-accent-text hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call rider
                </a>
              </div>
            )}
          </dl>
          {copyMessage && <p className="mt-2 text-sm text-muted" role="status">{copyMessage}</p>}
        </section>
      )}

      {actionError && !confirmDialogOpen && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger-text">
          {actionError}
        </p>
      )}

      <nav aria-label="Order actions" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {canConfirmDelivery && (
          <button
            type="button"
            ref={confirmDeliveryButtonRef}
            onClick={() => {
              setActionError(null);
              setConfirmDialogOpen(true);
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Confirm delivery
          </button>
        )}
        {canReportProblem && (
          <Link
            href={`/buyer/orders/${encodeURIComponent(order.id)}#returns`}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <AlertCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            Report a problem
          </Link>
        )}
        {order.status === "delivered" && item.product_id && (
          <Link
            href={`/product/${encodeURIComponent(item.product_id)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Buy again
          </Link>
        )}
        {order.vendor_id && (
          <Link
            href={`/messages?with=${encodeURIComponent(order.vendor_id)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Contact seller
          </Link>
        )}
      </nav>

      {confirmDialogOpen && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-background/60 p-4">
          <section
            ref={confirmationDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delivery-title"
            className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-lg sm:p-6"
          >
            <h2 id="confirm-delivery-title" className="text-lg font-semibold text-text">
              Confirm you received this item
            </h2>
            <p className="mt-2 text-sm text-muted">
              Confirm delivery only if you have received {item.product_name}.
            </p>
            {actionError && <p role="alert" className="mt-3 text-sm text-danger-text">{actionError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                ref={cancelConfirmationButtonRef}
                onClick={() => setConfirmDialogOpen(false)}
                disabled={confirming}
                className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                Not yet
              </button>
              <button
                type="button"
                onClick={() => void confirmDelivery()}
                disabled={confirming}
                className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {confirming ? "Confirming…" : "Yes, received"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function getWhatsNext(status: string): string {
  switch (status) {
    case "pending":
    case "placed":
      return "The seller will confirm your order next.";
    case "confirmed":
      return "The seller is preparing your item.";
    case "preparing":
      return "Your item will be handed to the courier next.";
    case "shipped":
    case "out_for_delivery":
      return "Your item is on its way to you.";
    case "delivered":
      return "Your item has been delivered.";
    case "cancelled":
      return "This order was cancelled.";
    default:
      return "Your order status will update as it progresses.";
  }
}
