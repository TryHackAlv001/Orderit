"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface OrderStatusEvent {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

const EMPTY_HISTORY: OrderStatusEvent[] = [];

interface OrderTimelineProps {
  status: string;
  orderId?: string;
  history?: OrderStatusEvent[];
}

const steps = [
  { key: "placed", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

function getProgress(status: string) {
  switch (status) {
    case "pending":
    case "placed":
      return 0;
    case "confirmed":
    case "preparing":
      return 1;
    case "shipped":
      return 2;
    case "out_for_delivery":
      return 3;
    case "delivered":
      return 4;
    default:
      return -1;
  }
}

export function OrderTimeline({ status, orderId, history = EMPTY_HISTORY }: OrderTimelineProps) {
  const [events, setEvents] = useState(history);
  const [liveError, setLiveError] = useState(false);

  useEffect(() => {
    setEvents(history);
  }, [history]);

  useEffect(() => {
    if (!orderId) return;
    const supabase = createClient();
    let active = true;
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "order_status_history",
        filter: `order_id=eq.${orderId}`,
      }, (payload) => {
        const event = payload.new as OrderStatusEvent;
        setEvents((current) => current.some((item) => item.id === event.id)
          ? current
          : [...current, event].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        setLiveError(false);
      })
      .subscribe((state) => {
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setLiveError(true);
          console.error(`Order ${orderId} tracking realtime subscription ${state.toLowerCase()}.`);
        }
      });

    void supabase
      .from("order_status_history")
      .select("id,status,note,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setLiveError(true);
          console.error("Unable to load order status history:", error.message);
          return;
        }
        if (data) {
          setEvents((current) => {
            const eventsById = new Map(current.map((event) => [event.id, event]));
            data.forEach((event) => eventsById.set(event.id, event));
            return Array.from(eventsById.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [orderId]);

  const currentStatus = events[events.length - 1]?.status ?? status;
  const progress = getProgress(currentStatus);
  const latestNote = useMemo(
    () => [...events].reverse().find((event) => event.note)?.note,
    [events]
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-text">Order tracking</h3>
      <p className="mt-2 text-sm text-muted">Follow your order from placement to delivery.</p>

      {currentStatus === "cancelled" ? (
        <div className="mt-6 rounded-lg border border-danger bg-danger/10 p-5">
          <p className="font-semibold text-danger-text">Order cancelled</p>
          <p className="mt-1 text-sm text-danger-text">This order will not progress further.</p>
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {steps.map((step, index) => {
            const completed = index <= progress;
            const event = events.find((item) => {
              return step.key === "placed"
                ? item.status === "placed" || item.status === "pending"
                : item.status === step.key;
            }) ?? (step.key === "shipped" && currentStatus === "out_for_delivery"
              ? events.find((item) => item.status === "out_for_delivery")
              : undefined);
            return (
              <li key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                    completed ? "border-accent bg-accent text-accent-on" : "border-border text-muted"
                  }`}>{completed ? "✓" : index + 1}</span>
                  {index < steps.length - 1 && <span className="mt-1 h-8 w-px bg-surface-raised" />}
                </div>
                <div className="min-w-0 pb-3">
                  <p className={`font-medium ${completed ? "text-text" : "text-muted"}`}>{step.label}</p>
                  {event && <time className="text-xs text-muted">{new Date(event.created_at).toLocaleString()}</time>}
                  {event?.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{event.note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {latestNote && !events.some((event) => event.note === latestNote && event.status === currentStatus) && (
        <p className="mt-4 rounded-lg bg-bg p-3 text-sm text-text">{latestNote}</p>
      )}
      {liveError && (
        <p className="mt-4 text-xs text-text" role="status">
          Live updates are temporarily unavailable. Refresh this page to check for changes.
        </p>
      )}
    </div>
  );
}
