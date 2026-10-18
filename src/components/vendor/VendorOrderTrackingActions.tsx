"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Truck, X } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { ORDER_STATUS_LABELS } from "@/constants/order-status";
import { createClient } from "@/lib/supabase/client";
import { trackingNumberError, trackingUrlError } from "@/lib/tracking-validation";

type DeliveryMethod = "courier" | "rider" | "pickup";

interface TrackingDetails {
  courier_name: string;
  rider_name: string;
  rider_phone: string;
  tracking_number: string;
  tracking_url: string;
  estimated_delivery_at: string;
  tracking_note: string;
}

export interface VendorOrderUpdate {
  status: string;
  courier_name?: string | null;
  rider_name?: string | null;
  rider_phone?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  tracking_note?: string | null;
  estimated_delivery_at?: string | null;
  delivered_at?: string | null;
  cancellation_reason?: string | null;
}

interface VendorOrderTrackingActionsProps {
  orderId: string;
  status: string;
  buyerId?: string;
  onStatusChange?: (newStatus: string, updatedOrder?: VendorOrderUpdate) => void;
}

const stepForStatus: Record<string, { status: string; label: string }> = {
  pending: { status: "confirmed", label: "Confirm Order" },
  confirmed: { status: "preparing", label: `Mark as ${ORDER_STATUS_LABELS.preparing}` },
  preparing: { status: "out_for_delivery", label: `Mark as ${ORDER_STATUS_LABELS.out_for_delivery}` },
  out_for_delivery: { status: "delivered", label: `Mark as ${ORDER_STATUS_LABELS.delivered}` },
};

const emptyTrackingDetails: TrackingDetails = {
  courier_name: "",
  rider_name: "",
  rider_phone: "",
  tracking_number: "",
  tracking_url: "",
  estimated_delivery_at: "",
  tracking_note: "",
};

function validateDeliveryDetails(method: DeliveryMethod, details: TrackingDetails): string | null {
  if (method === "pickup" && !details.tracking_note.trim()) {
    return "Enter the pickup address or instructions.";
  }
  if (method === "courier" && !details.courier_name.trim()) {
    return "Enter the courier or logistics company name.";
  }
  if (method === "rider" && !details.rider_name.trim()) {
    return "Enter the rider name.";
  }
  if (method === "rider" && !details.rider_phone.trim()) {
    return "Enter a phone number for the rider.";
  }
  if (method !== "pickup" && !details.estimated_delivery_at) {
    return method === "courier"
      ? "Enter the estimated delivery date."
      : "Enter the estimated delivery date and time.";
  }

  if (details.estimated_delivery_at) {
    const isDateOnly = method !== "rider";
    const estimatedDate = new Date(
      isDateOnly ? `${details.estimated_delivery_at}T23:59:00Z` : details.estimated_delivery_at,
    );
    if (Number.isNaN(estimatedDate.getTime())) {
      return method === "rider"
        ? "Enter a valid estimated delivery date and time."
        : "Enter a valid date.";
    }
    if (estimatedDate.getTime() < Date.now()) {
      return method === "rider"
        ? "The estimated delivery date and time must be in the future."
        : "Choose a date that has not passed.";
    }
  }
  return null;
}

function localDateInputValue(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function VendorOrderTrackingActions({
  orderId,
  status,
  buyerId,
  onStatusChange,
}: VendorOrderTrackingActionsProps) {
  const router = useRouter();
  const dialogTitleId = useId();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [dialog, setDialog] = useState<"step" | "tracking" | "cancel" | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("courier");
  const [trackingDetails, setTrackingDetails] = useState(emptyTrackingDetails);
  const [trackingNumberFieldError, setTrackingNumberFieldError] = useState<string | null>(null);
  const [trackingUrlFieldError, setTrackingUrlFieldError] = useState<string | null>(null);
  const [duplicateTrackingNotice, setDuplicateTrackingNotice] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const duplicateCheckId = useRef(0);
  const step = stepForStatus[currentStatus];
  const canCancel = ["pending", "confirmed", "preparing"].includes(currentStatus);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const checkDuplicateTrackingNumber = async (value: string, showToast = false) => {
    const requestId = ++duplicateCheckId.current;
    const trackingNumber = value.trim();
    if (!trackingNumber) {
      setDuplicateTrackingNotice(null);
      return false;
    }

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Sign in again to check this tracking number.");

      const { data, error: queryError } = await supabase
        .from("orders")
        .select("id")
        .eq("vendor_id", authData.user.id)
        .eq("tracking_number", trackingNumber)
        .neq("id", orderId)
        .limit(1);
      if (queryError) throw queryError;

      const duplicate = Boolean(data?.length);
      if (requestId === duplicateCheckId.current) {
        setDuplicateTrackingNotice(
          duplicate
            ? "This tracking number is also used on another order. Check that it matches this parcel."
            : null,
        );
      }
      if (duplicate && showToast && requestId === duplicateCheckId.current) {
        toast("This tracking number is also used on another order. Please check it.");
      }
      return duplicate;
    } catch (checkError) {
      console.error("Unable to check for a duplicate tracking number:", checkError);
      if (requestId === duplicateCheckId.current) {
        setDuplicateTrackingNotice("We could not check for duplicates. You can still continue.");
      }
      if (showToast) {
        toast("We could not verify this tracking number. Please double-check it.");
      }
      return false;
    }
  };

  const submitTransition = async (
    nextStatus: string,
    details: Record<string, string>,
  ) => {
    const previousStatus = currentStatus;
    setLoading(true);
    setError(null);
    setCurrentStatus(nextStatus);
    onStatusChange?.(nextStatus);

    try {
      const response = await fetch(`/api/vendor/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, details }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "The order status could not be updated.");
      }
      onStatusChange?.(result.order.status, result.order);
      setDialog(null);
      setTrackingDetails(emptyTrackingDetails);
      setCancellationReason("");
      toast.success("Order updated.");
      router.refresh();
    } catch (updateError) {
      const message = updateError instanceof Error
        ? updateError.message
        : "The order status could not be updated.";
      setCurrentStatus(previousStatus);
      onStatusChange?.(previousStatus);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const confirmStep = () => {
    if (!step) return;
    void submitTransition(step.status, {});
  };

  const submitTracking = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numberError = deliveryMethod === "courier"
      ? trackingNumberError(trackingDetails.tracking_number)
      : null;
    const urlError = deliveryMethod === "courier"
      ? trackingUrlError(trackingDetails.tracking_url)
      : null;
    setTrackingNumberFieldError(numberError);
    setTrackingUrlFieldError(urlError);
    if (numberError || urlError) {
      setError(null);
      return;
    }

    const validationError = validateDeliveryDetails(deliveryMethod, trackingDetails);
    if (validationError) {
      setError(validationError);
      return;
    }

    const dateOnly = deliveryMethod !== "rider";
    const estimatedDeliveryAt = trackingDetails.estimated_delivery_at
      ? new Date(
          dateOnly
          ? `${trackingDetails.estimated_delivery_at}T23:59:00Z`
            : trackingDetails.estimated_delivery_at,
        ).toISOString()
      : "";
    const details: Record<string, string> = {
      courier_name: deliveryMethod === "courier" ? trackingDetails.courier_name.trim() : "",
      rider_name: deliveryMethod === "rider" ? trackingDetails.rider_name.trim() : "",
      rider_phone: deliveryMethod === "rider" ? trackingDetails.rider_phone.trim() : "",
      tracking_number: deliveryMethod === "courier" ? trackingDetails.tracking_number.trim() : "",
      tracking_url: deliveryMethod === "courier" ? trackingDetails.tracking_url.trim() : "",
      estimated_delivery_at: estimatedDeliveryAt,
    };
    if (deliveryMethod === "pickup") {
      details.tracking_note = trackingDetails.tracking_note.trim();
    } else if (deliveryMethod === "courier") {
      void checkDuplicateTrackingNumber(trackingDetails.tracking_number, true);
    }
    void submitTransition("out_for_delivery", details);
  };

  const submitCancellation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = cancellationReason.trim();
    if (!reason) {
      setError("Enter a reason for cancelling this order.");
      return;
    }
    void submitTransition("cancelled", { cancellation_reason: reason });
  };

  const closeDialog = () => {
    if (!loading) {
      setDialog(null);
      setError(null);
      setTrackingNumberFieldError(null);
      setTrackingUrlFieldError(null);
    }
  };

  return (
    <div className="min-w-0 space-y-3">
      {error && !dialog && (
        <p role="alert" className="break-words rounded-lg bg-danger/10 p-3 text-sm text-danger-text">
          {error}
        </p>
      )}
      {step ? (
        <Button
          type="button"
          onClick={() => {
            setError(null);
            setDialog(step.status === "out_for_delivery" ? "tracking" : "step");
          }}
          disabled={loading}
          className="min-h-11 w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:opacity-60 sm:w-auto"
        >
          <Truck className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{loading ? "Updating order…" : step.label}</span>
        </Button>
      ) : (
        <p className={`text-sm font-medium ${currentStatus === "cancelled" ? "text-danger-text" : "text-accent-text"}`}>
          {currentStatus === "cancelled" ? "Order cancelled" : currentStatus === "delivered" ? "Order completed" : "No available status update"}
        </p>
      )}

      {canCancel && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDialog("cancel");
          }}
          disabled={loading}
          className="min-h-11 rounded-full px-4 py-2 text-sm font-semibold text-danger-text underline underline-offset-4 disabled:opacity-60"
        >
          Cancel order
        </button>
      )}

      {buyerId && (
        <Button
          type="button"
          onClick={() => router.push(`/messages?with=${buyerId}`)}
          variant="outline"
          className="min-h-11 rounded-full px-4 py-3 text-sm font-semibold"
        >
          <MessageCircle className="mr-2 h-4 w-4 shrink-0" />
          Message Buyer
        </Button>
      )}

      {dialog && (
        <div
          className="fixed inset-0 z-modal flex items-end justify-center overflow-y-auto bg-black/60 p-3 pt-[calc(var(--safe-top)+0.75rem)] pb-[calc(var(--safe-bottom)+0.75rem)] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-4 text-text shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={dialogTitleId} className="min-w-0 text-lg font-semibold">
                {dialog === "tracking"
                  ? "Delivery and tracking details"
                  : dialog === "cancel"
                    ? "Cancel this order?"
                    : `Confirm: ${step?.label ?? "update order"}`}
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                disabled={loading}
                aria-label="Close dialog"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-text disabled:opacity-60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <p role="alert" className="mt-4 break-words rounded-lg bg-danger/10 p-3 text-sm text-danger-text">
                {error}
              </p>
            )}

            {dialog === "tracking" ? (
              <form onSubmit={submitTracking} className="mt-4 space-y-4">
                <p className="text-sm text-muted">
                  Add the delivery details before marking this order out for delivery.
                </p>
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold">How are you delivering this?</legend>
                  {([
                    ["courier", "Courier or logistics company"],
                    ["rider", "My own rider"],
                    ["pickup", "Buyer pickup"],
                  ] as const).map(([method, label]) => (
                    <label
                      key={method}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                        deliveryMethod === method
                          ? "border-accent bg-accent/10 text-text"
                          : "border-border text-text hover:bg-bg"
                      }`}
                    >
                      <input
                        type="radio"
                        name="delivery-method"
                        value={method}
                        checked={deliveryMethod === method}
                        onChange={() => {
                          duplicateCheckId.current += 1;
                          setDeliveryMethod(method);
                          setTrackingDetails((current) => ({ ...current, estimated_delivery_at: "" }));
                          setError(null);
                          setTrackingNumberFieldError(null);
                          setTrackingUrlFieldError(null);
                          setDuplicateTrackingNotice(null);
                        }}
                        className="h-4 w-4 shrink-0 accent-accent"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </fieldset>

                {deliveryMethod === "courier" && (
                  <>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Courier or logistics company name <span className="text-danger-text">*</span></span>
                      <input
                        value={trackingDetails.courier_name}
                        onChange={(event) => setTrackingDetails({ ...trackingDetails, courier_name: event.target.value })}
                        maxLength={160}
                        autoComplete="organization"
                        required
                        className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-base text-text"
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Tracking number <span className="font-normal text-muted">(optional, recommended)</span></span>
                      <input
                        value={trackingDetails.tracking_number}
                        onChange={(event) => {
                          duplicateCheckId.current += 1;
                          setTrackingDetails({ ...trackingDetails, tracking_number: event.target.value });
                          setTrackingNumberFieldError(trackingNumberError(event.target.value));
                          setDuplicateTrackingNotice(null);
                        }}
                        onBlur={() => {
                          if (!trackingNumberError(trackingDetails.tracking_number)) {
                            void checkDuplicateTrackingNumber(trackingDetails.tracking_number);
                          }
                        }}
                        maxLength={64}
                        autoCapitalize="off"
                        autoCorrect="off"
                        aria-invalid={Boolean(trackingNumberFieldError)}
                        aria-describedby="tracking-number-help tracking-number-error"
                        placeholder="e.g. the code on your courier receipt"
                        className={`min-h-11 w-full min-w-0 rounded-lg border bg-bg px-3 py-2.5 text-base text-text ${
                          trackingNumberFieldError ? "border-danger" : "border-border"
                        }`}
                      />
                      <span id="tracking-number-help" className="block text-xs font-normal text-muted">
                        Enter the waybill or tracking code from your courier&apos;s receipt, exactly as printed. Leave it empty if you don&apos;t have one.
                      </span>
                      {trackingNumberFieldError && (
                        <span id="tracking-number-error" className="block text-sm font-normal text-danger-text" role="alert">
                          {trackingNumberFieldError}
                        </span>
                      )}
                      {duplicateTrackingNotice && (
                        <span className="block break-words text-sm font-normal text-muted" role="status">
                          {duplicateTrackingNotice}
                        </span>
                      )}
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Tracking link <span className="font-normal text-muted">(optional)</span></span>
                      <input
                        type="text"
                        value={trackingDetails.tracking_url}
                        onChange={(event) => {
                          setTrackingDetails({ ...trackingDetails, tracking_url: event.target.value });
                          setTrackingUrlFieldError(trackingUrlError(event.target.value));
                        }}
                        maxLength={2048}
                        inputMode="url"
                        autoCapitalize="off"
                        autoCorrect="off"
                        aria-invalid={Boolean(trackingUrlFieldError)}
                        aria-describedby="tracking-url-error"
                        placeholder="https://courier.com/track"
                        className={`min-h-11 w-full min-w-0 rounded-lg border bg-bg px-3 py-2.5 text-base text-text ${
                          trackingUrlFieldError ? "border-danger" : "border-border"
                        }`}
                      />
                      {trackingUrlFieldError && (
                        <span id="tracking-url-error" className="block text-sm font-normal text-danger-text" role="alert">
                          {trackingUrlFieldError}
                        </span>
                      )}
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Estimated delivery date <span className="text-danger-text">*</span></span>
                      <input
                        type="date"
                        min={localDateInputValue()}
                        value={trackingDetails.estimated_delivery_at}
                        onChange={(event) => setTrackingDetails({ ...trackingDetails, estimated_delivery_at: event.target.value })}
                        required
                        className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2.5 text-base text-text"
                      />
                    </label>
                  </>
                )}

                {deliveryMethod === "rider" && (
                  <>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Rider name <span className="text-danger-text">*</span></span>
                      <input
                        value={trackingDetails.rider_name}
                        onChange={(event) => setTrackingDetails({ ...trackingDetails, rider_name: event.target.value })}
                        maxLength={160}
                        autoComplete="name"
                        required
                        className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-base text-text"
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Rider phone <span className="text-danger-text">*</span></span>
                      <input
                        type="tel"
                        value={trackingDetails.rider_phone}
                        onChange={(event) => setTrackingDetails({ ...trackingDetails, rider_phone: event.target.value })}
                        maxLength={40}
                        autoComplete="tel"
                        required
                        className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-base text-text"
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Estimated delivery date and time <span className="text-danger-text">*</span></span>
                      <input
                        type="datetime-local"
                        min={`${localDateInputValue()}T00:00`}
                        value={trackingDetails.estimated_delivery_at}
                        onChange={(event) => setTrackingDetails({ ...trackingDetails, estimated_delivery_at: event.target.value })}
                        required
                        className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2.5 text-base text-text"
                      />
                    </label>
                  </>
                )}

                {deliveryMethod === "pickup" && (
                  <>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Pickup address or instructions <span className="text-danger-text">*</span></span>
                      <textarea
                        value={trackingDetails.tracking_note}
                        onChange={(event) => setTrackingDetails({ ...trackingDetails, tracking_note: event.target.value })}
                        maxLength={500}
                        required
                        rows={3}
                        className="w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2.5 text-base text-text"
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm font-medium">
                      <span>Pickup-ready date <span className="font-normal text-muted">(optional)</span></span>
                      <input
                        type="date"
                        min={localDateInputValue()}
                        value={trackingDetails.estimated_delivery_at}
                        onChange={(event) => setTrackingDetails({ ...trackingDetails, estimated_delivery_at: event.target.value })}
                        className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2.5 text-base text-text"
                      />
                    </label>
                  </>
                )}
                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={loading} className="min-h-11 rounded-full px-4">
                    Back
                  </Button>
                  <Button type="submit" disabled={loading} className="min-h-11 rounded-full bg-accent px-4 text-accent-on disabled:opacity-60">
                    {loading ? "Updating…" : "Confirm and mark out for delivery"}
                  </Button>
                </div>
              </form>
            ) : dialog === "cancel" ? (
              <form onSubmit={submitCancellation} className="mt-4 space-y-4">
                <p className="text-sm text-muted">The buyer will be notified. A reason is required.</p>
                <label className="block space-y-1.5 text-sm font-medium">
                  <span>Cancellation reason</span>
                  <textarea
                    value={cancellationReason}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    maxLength={1000}
                    required
                    rows={3}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-base text-text"
                  />
                </label>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={loading} className="min-h-11 rounded-full px-4">
                    Keep order
                  </Button>
                  <Button type="submit" disabled={loading} className="min-h-11 rounded-full bg-danger px-4 text-accent-on disabled:opacity-60">
                    {loading ? "Cancelling…" : "Confirm cancellation"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-muted">
                  {step?.status === "confirmed"
                    ? "Confirm that you are ready to accept this order."
                    : step?.status === "preparing"
                      ? "Mark this order as packing."
                      : "Confirm that this order has been delivered."}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={loading} className="min-h-11 rounded-full px-4">
                    Go back
                  </Button>
                  <Button type="button" onClick={confirmStep} disabled={loading} className="min-h-11 rounded-full bg-accent px-4 text-accent-on disabled:opacity-60">
                    {loading ? "Updating…" : `Confirm ${step?.label ?? "update"}`}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
