"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ORDER_TRACKING_STEPS } from "@/constants/order-status";

export interface OrderStatusEvent {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface OrderStatusHistoryRow {
  id: string;
  to_status: string;
  note: string | null;
  created_at: string;
}

const EMPTY_HISTORY: OrderStatusEvent[] = [];

interface OrderTimelineProps {
  status: string;
  orderId?: string;
  history?: OrderStatusEvent[];
  cancellationReason?: string | null;
  onStatusChange?: (status: string) => void;
}

function getProgress(status: string) {
  switch (status) {
    case "pending":
    case "placed":
      return 0;
    case "confirmed":
      return 1;
    case "preparing":
      return 2;
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

function mergeEvents(current: OrderStatusEvent[], next: OrderStatusEvent[]) {
  const eventsById = new Map(current.map((event) => [event.id, event]));
  next.forEach((event) => eventsById.set(event.id, event));
  return Array.from(eventsById.values())
    .sort((first, second) => first.created_at.localeCompare(second.created_at));
}

function toOrderStatusEvent(row: OrderStatusHistoryRow): OrderStatusEvent {
  return {
    id: row.id,
    status: row.to_status,
    note: row.note,
    created_at: row.created_at,
  };
}

export function OrderTimeline({
  status,
  orderId,
  history = EMPTY_HISTORY,
  cancellationReason,
  onStatusChange,
}: OrderTimelineProps) {
  const [events, setEvents] = useState(history);
  const [liveError, setLiveError] = useState(false);
  const [polling, setPolling] = useState(false);
  const eventsOrderIdRef = useRef(orderId);

  useEffect(() => {
    if (eventsOrderIdRef.current !== orderId) {
      eventsOrderIdRef.current = orderId;
      setEvents(history);
      return;
    }
    setEvents((current) => mergeEvents(current, history));
  }, [history, orderId]);

  const currentStatus = events[events.length - 1]?.status ?? status;
  useEffect(() => {
    onStatusChange?.(currentStatus);
  }, [currentStatus, onStatusChange]);

  useEffect(() => {
    if (!orderId) return;
    const supabase = createClient();
    let active = true;
    let subscribed = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const refreshHistory = async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("id,to_status,note,created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) {
        setLiveError(true);
        console.error("Unable to refresh order status history:", error.message);
        startPolling();
        return;
      }
      const freshEvents = (data ?? []).map((row) => toOrderStatusEvent(row as OrderStatusHistoryRow));
      setEvents((current) => mergeEvents(current, freshEvents));
      setLiveError(false);
      if (subscribed && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
        setPolling(false);
      }
    };

    const startPolling = () => {
      if (!active || pollTimer) return;
      setPolling(true);
      void refreshHistory();
      pollTimer = setInterval(() => void refreshHistory(), 30_000);
    };

    const subscribeTimer = setTimeout(() => {
      if (!subscribed) startPolling();
    }, 10_000);

    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "order_status_history",
        filter: `order_id=eq.${orderId}`,
      }, async (payload) => {
        if (!active) return;
        const { data, error } = await supabase
          .from("order_status_history")
          .select("id,to_status,note,created_at")
          .eq("id", payload.new.id)
          .single();
        if (!active) return;
        if (error) {
          setLiveError(true);
          console.error("Unable to load new order status event:", error.message);
          startPolling();
          return;
        }
        const event = toOrderStatusEvent(data);
        setEvents((current) => mergeEvents(current, [event]));
        setLiveError(false);
        if (subscribed && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = undefined;
          setPolling(false);
        }
      })
      .subscribe((state) => {
        if (!active) return;
        if (state === "SUBSCRIBED") {
          subscribed = true;
          if (subscribeTimer) clearTimeout(subscribeTimer);
          void refreshHistory();
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setLiveError(true);
          console.error(`Order ${orderId} tracking realtime subscription ${state.toLowerCase()}.`);
          startPolling();
        }
      });

    void refreshHistory();

    return () => {
      active = false;
      if (pollTimer) clearInterval(pollTimer);
      if (subscribeTimer) clearTimeout(subscribeTimer);
      void supabase.removeChannel(channel);
    };
  }, [orderId]);

  const progressStatus = currentStatus === "cancelled"
    ? events.length > 1
      ? events[events.length - 2].status
      : "placed"
    : currentStatus;
  const progress = getProgress(progressStatus);
  const cancellationEvent = [...events].reverse().find((event) => event.status === "cancelled");
  const latestNote = useMemo(
    () => [...events].reverse().find((event) => event.note)?.note,
    [events],
  );

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
      {currentStatus === "cancelled" && (
        <div className="mb-5 rounded-lg border border-danger/30 bg-danger/10 p-4" role="status">
          <p className="font-semibold text-danger-text">This order was cancelled</p>
          <p className="mt-1 text-sm text-danger-text">
            {cancellationReason || cancellationEvent?.note || "This order will not progress further."}
          </p>
        </div>
      )}

      <ol className="space-y-1">
        {ORDER_TRACKING_STEPS.map((step, index) => {
          const completed = index <= progress;
          const event = events.find((item) => {
            if (step.key === "placed") return item.status === "placed" || item.status === "pending";
            return item.status === step.key;
          });
          const isCurrent = completed
            && index === progress
            && currentStatus !== "cancelled"
            && progressStatus !== "shipped";

          return (
            <li key={step.key} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
              <div className="flex h-full flex-col items-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                    completed
                      ? "border-accent bg-accent text-accent-on"
                      : "border-border bg-bg text-muted"
                  } ${isCurrent ? "ring-2 ring-accent/30 ring-offset-2 ring-offset-surface" : ""}`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {completed ? "✓" : index + 1}
                </span>
                {index < ORDER_TRACKING_STEPS.length - 1 && (
                  <span className={`my-1 min-h-7 w-px flex-1 ${index < progress ? "bg-accent/60" : "bg-border"}`} />
                )}
              </div>
              <div className="min-w-0 pb-4">
                <p className={`font-medium ${completed ? "text-text" : "text-muted"}`}>{step.label}</p>
                {event && (
                  <time className="text-xs text-muted" dateTime={event.created_at}>
                    {new Date(event.created_at).toLocaleString("en-NG")}
                  </time>
                )}
                {event?.note && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{event.note}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {latestNote && currentStatus !== "cancelled" && (
        <p className="mt-2 rounded-lg bg-bg p-3 text-sm text-text">{latestNote}</p>
      )}
      {polling && (
        <p className="mt-3 text-xs text-muted" role="status">
          Live updates are unavailable. Checking for updates every 30 seconds.
        </p>
      )}
      {liveError && !polling && (
        <p className="mt-3 text-xs text-danger-text" role="status">
          We couldn&apos;t refresh the tracking timeline. The next update will retry automatically.
        </p>
      )}
    </div>
  );
}
