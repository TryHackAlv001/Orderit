"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpRight, Package } from "lucide-react";
import { statusColor, statusLabel } from "@/lib/order-status";
import { isBuyerOrderInProgress } from "@/lib/buyer-orders";
import type { BuyerOrdersFilter, BuyerPurchasedItem } from "@/app/(main)/buyer/orders/OrdersPage";

const ITEMS_PER_PAGE = 10;

function ItemSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid min-h-[156px] animate-pulse grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-lg border border-border bg-surface p-3 sm:min-h-[112px] sm:grid-cols-[64px_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4 sm:p-4"
    >
      <div className="row-span-3 aspect-square rounded-md bg-surface-raised sm:row-span-1" />
      <div className="h-5 min-w-0 rounded bg-surface-raised" />
      <div className="col-start-2 h-4 w-3/4 rounded bg-surface-raised sm:col-start-auto" />
      <div className="col-span-2 h-11 rounded-full bg-surface-raised sm:col-span-1" />
    </div>
  );
}

function formatMoney(value: number): string {
  return `₦${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function PurchasedItemsList({
  items,
  error,
  filter,
}: {
  items: BuyerPurchasedItem[];
  error: boolean;
  filter: BuyerOrdersFilter;
}) {
  const router = useRouter();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    loadingMoreRef.current = false;
    setIsLoadingMore(false);
  }, [filter, items]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    window.requestAnimationFrame(() => {
      setVisibleCount((current) => Math.min(current + ITEMS_PER_PAGE, items.length));
      setIsLoadingMore(false);
      loadingMoreRef.current = false;
    });
  }, [items.length]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleCount >= items.length || error) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: "400px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [error, items.length, loadMore, visibleCount]);

  const retry = useCallback(() => {
    startRefresh(() => router.refresh());
  }, [router]);

  if (error) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-danger/30 bg-danger/10 p-4 sm:p-6">
        <p className="font-semibold text-danger-text">Your orders could not be loaded.</p>
        <p className="text-sm text-muted">Check your connection and try again.</p>
        {isRefreshing ? (
          <div className="space-y-3" aria-label="Loading orders" aria-live="polite">
            {[0, 1].map((index) => <ItemSkeleton key={index} />)}
          </div>
        ) : (
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    const emptyMessage =
      filter === "in_progress"
        ? "No orders in progress"
        : filter === "delivered"
          ? "No delivered orders yet"
          : filter === "cancelled"
            ? "No cancelled orders"
            : "No orders yet";

    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center sm:p-10">
        <Package className="mx-auto h-10 w-10 text-muted" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold text-text">{emptyMessage}</p>
        <p className="mt-1 text-sm text-muted">Your purchased products will show up here.</p>
        <Link
          href="/marketplace"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Browse products
        </Link>
      </div>
    );
  }

  const seenOrderIds = new Set<string>();
  const visibleItems = items.slice(0, visibleCount).map((item) => {
    const isFirstOrderItem = !seenOrderIds.has(item.order_id);
    seenOrderIds.add(item.order_id);
    return { item, isFirstOrderItem };
  });

  return (
    <section aria-label="Orders" className="min-w-0 space-y-3">
      {visibleItems.map(({ item, isFirstOrderItem }) => (
        <PurchasedItemRow key={item.id} item={item} showOrderTotal={isFirstOrderItem} />
      ))}
      {isLoadingMore && (
        <div className="space-y-3" aria-label="Loading more orders" aria-live="polite">
          {[0, 1].map((index) => <ItemSkeleton key={index} />)}
        </div>
      )}
      <div ref={loadMoreRef} className="h-2" aria-hidden="true" />
      {visibleCount >= items.length && (
        <p className="py-3 text-center text-sm text-muted">You&apos;re all caught up.</p>
      )}
    </section>
  );
}

function PurchasedItemRow({
  item,
  showOrderTotal,
}: {
  item: BuyerPurchasedItem;
  showOrderTotal: boolean;
}) {
  const detailHref = `/buyer/orders/${item.order_id}`;
  const trackerHref = `${detailHref}/track?item=${encodeURIComponent(item.id)}`;
  const isPendingAndUnpaid =
    item.order_status === "pending" && item.payment_status !== "paid";
  const isTrackable = isBuyerOrderInProgress(item.order_status) && item.payment_status === "paid";
  const action = isPendingAndUnpaid
    ? { href: detailHref, label: "Continue payment", primary: true }
    : isTrackable
      ? { href: trackerHref, label: "Track", primary: true }
      : { href: detailHref, label: "View", primary: false };
  const variant = [
    item.selected_size ? `Size: ${item.selected_size}` : null,
    item.selected_color ? `Color: ${item.selected_color}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const [orderDate, setOrderDate] = useState(() => new Date(item.order_created_at).toISOString());

  useEffect(() => {
    const date = new Date(item.order_created_at);
    if (Number.isNaN(date.getTime())) return;
    setOrderDate(date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }));
  }, [item.order_created_at]);

  return (
    <article className="group relative grid min-h-[156px] min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border border-border bg-surface p-3 shadow-sm transition-colors hover:border-accent/50 hover:bg-surface-raised sm:min-h-[112px] sm:grid-cols-[64px_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4 sm:p-4">
      <Link
        href={detailHref}
        aria-label={`View order #${item.order_id.slice(0, 8)} details for ${item.product_name}`}
        className="absolute inset-0 z-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <div className="pointer-events-none relative z-10 row-span-3 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-bg sm:row-span-1">
        {item.product_image ? (
          <img src={item.product_image} alt="" className="h-full w-full object-cover" />
        ) : (
          <Package className="h-6 w-6 text-muted" aria-hidden="true" />
        )}
      </div>
      <div className="pointer-events-none relative z-10 min-w-0 self-end sm:self-center">
        <p className="truncate font-semibold text-text" title={item.product_name}>{item.product_name}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="max-w-full truncate">Order #{item.order_id.slice(0, 8)}</span>
          <time className="max-w-full truncate" dateTime={item.order_created_at}>{orderDate}</time>
          {showOrderTotal && (
            <span className="font-semibold text-text">Order total {formatMoney(item.order_total)}</span>
          )}
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-semibold text-text">{formatMoney(item.price_at_purchase)} each</span>
          <span className="text-muted">Qty {item.quantity}</span>
          <span
            className="max-w-full truncate text-muted"
            title={variant || "Variant not recorded"}
          >
            {variant || "Variant not recorded"}
          </span>
        </div>
      </div>
      <span
        className={`relative z-10 col-start-2 inline-flex min-h-6 w-fit max-w-full items-center truncate rounded-full px-2.5 text-xs font-semibold sm:col-start-auto ${statusColor(item.order_status)}`}
      >
        {statusLabel(item.order_status)}
      </span>
      <Link
        href={action.href}
        className={`relative z-20 col-span-2 inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-1 ${
          action.primary
            ? "bg-accent text-accent-on hover:bg-accent-hover"
            : "border border-border bg-surface text-text hover:bg-surface-raised"
        }`}
      >
        <span className="truncate">{action.label}</span>
        <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Link>
    </article>
  );
}
