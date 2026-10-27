"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PurchasedItemsList } from "@/components/order/PurchasedItemsList";
import type { BuyerOrdersFilter, BuyerPurchasedItem } from "./OrdersPage";

export function BuyerOrdersPage({
  items,
  error,
  filter,
  inProgressOrderCount,
}: {
  items: BuyerPurchasedItem[];
  error: boolean;
  filter: BuyerOrdersFilter;
  inProgressOrderCount: number;
}) {
  const filterLinks: { id: BuyerOrdersFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "in_progress", label: `In progress (${inProgressOrderCount})` },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="min-w-0 space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-0 md:px-4">
      <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-text">Orders</h1>
            <p className="mt-2 text-sm text-muted">Review your purchased items and order progress.</p>
          </div>
          <Link
            href="/marketplace"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Continue Shopping
          </Link>
        </div>
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1" aria-label="Order filters">
        {filterLinks.map(({ id, label }) => (
          <Link
            key={id}
            href={id === "all" ? "/buyer/orders" : `/buyer/orders?filter=${id}`}
            aria-current={filter === id ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 ${
              filter === id ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <PurchasedItemsList items={items} error={error} filter={filter} />
    </div>
  );
}
