'use client';

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useMessagingSummary } from "@/hooks/useMessagingSummary";

export function FloatingMessageButton() {
  const { conversations } = useMessagingSummary();
  const unreadCount = conversations.reduce((count, conversation) => count + conversation.unreadCount, 0);

  return (
    <Link
      href="/messages"
      aria-label={`Messages${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      className="fixed bottom-6 right-6 z-floating-back hidden h-14 w-14 items-center justify-center rounded-full border border-border bg-surface text-accent-text shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transition-none md:flex"
      style={{
        bottom: "calc(24px + var(--safe-bottom))",
        right: "calc(24px + env(safe-area-inset-right, 0px))",
      }}
    >
      <MessageSquare className="h-6 w-6" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          aria-live="polite"
          aria-atomic="true"
          className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-on"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}