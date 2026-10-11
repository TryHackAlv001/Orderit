"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ReturnStatusEvent {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

const steps = [
  "requested",
  "approved",
  "pickup_scheduled",
  "picked_up",
  "received_by_vendor",
  "refunded",
];

const labels: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  pickup_scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  received_by_vendor: "Received by vendor",
  refunded: "Refunded to wallet",
};

export function ReturnTrackingTimeline({
  returnRequestId,
  status,
  initialHistory,
}: {
  returnRequestId: string;
  status: string;
  initialHistory: ReturnStatusEvent[];
}) {
  const [events, setEvents] = useState(initialHistory);
  const [liveError, setLiveError] = useState(false);

  useEffect(() => setEvents(initialHistory), [initialHistory]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`return-tracking-${returnRequestId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "return_status_history",
        filter: `return_request_id=eq.${returnRequestId}`,
      }, (payload) => {
        const event = payload.new as ReturnStatusEvent;
        setEvents((current) => current.some((item) => item.id === event.id)
          ? current
          : [...current, event].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        setLiveError(false);
      })
      .subscribe((state) => {
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setLiveError(true);
          console.error(`Return ${returnRequestId} realtime subscription ${state.toLowerCase()}.`);
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [returnRequestId]);

  const currentStatus = events[events.length - 1]?.status ?? status;
  if (currentStatus === "rejected") {
    return (
      <div className="mt-3 rounded-lg border border-danger bg-danger/10 p-4">
        <p className="font-semibold text-danger-text">Return rejected</p>
        {events.filter((event) => event.note).map((event) => (
          <p key={event.id} className="mt-1 text-sm text-danger-text">{event.note}</p>
        ))}
        {liveError && <p className="mt-2 text-xs text-text">Live updates unavailable; refresh to check again.</p>}
      </div>
    );
  }

  const currentIndex = steps.indexOf(currentStatus);
  return (
    <div className="mt-4">
      <ol className="space-y-3">
        {steps.map((step, index) => {
          const event = events.find((item) => item.status === step);
          const complete = index <= currentIndex;
          return (
            <li key={step} className="flex gap-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                complete ? "border-accent bg-accent text-accent-on" : "border-border text-muted"
              }`}>{complete ? "✓" : index + 1}</span>
              <div>
                <p className={`text-sm font-medium ${complete ? "text-text" : "text-muted"}`}>{labels[step]}</p>
                {event && <time className="text-xs text-muted">{new Date(event.created_at).toLocaleString()}</time>}
                {event?.note && <p className="mt-1 text-sm text-muted">{event.note}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {liveError && <p className="mt-3 text-xs text-text">Live updates unavailable; refresh to check again.</p>}
    </div>
  );
}
