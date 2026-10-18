"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Package } from "lucide-react";
import { statusColor, statusLabel } from "@/lib/order-status";

interface PurchasedItem {
  id: string;
  order_id: string;
  order_status: string;
  product_name: string;
  product_image: string | null;
  selected_size: string | null;
  selected_color: string | null;
  quantity: number;
  price_at_purchase: number;
}

interface ItemsResponse {
  items: PurchasedItem[];
  hasMore: boolean;
  inProgressOrderCount: number;
  error?: string;
}

function ItemSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid min-h-[156px] animate-pulse grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-lg border border-border bg-surface p-3 sm:min-h-[112px] sm:grid-cols-[72px_minmax(0,1fr)_repeat(4,minmax(64px,auto))_auto] sm:items-center sm:gap-4 sm:p-4"
    >
      <div className="row-span-2 aspect-square rounded-md bg-surface-raised sm:row-span-1" />
      <div className="h-5 min-w-0 rounded bg-surface-raised" />
      <div className="col-start-2 h-4 w-3/4 rounded bg-surface-raised sm:col-start-auto" />
      <div className="col-start-2 h-4 w-1/2 rounded bg-surface-raised sm:col-start-auto" />
      <div className="col-span-2 h-11 rounded-full bg-surface-raised sm:col-span-1" />
    </div>
  );
}

export function PurchasedItemsList() {
  const [items, setItems] = useState<PurchasedItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inProgressOrderCount, setInProgressOrderCount] = useState<number | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    setItems([]);
    setPage(0);
    setHasMore(true);
    setInProgressOrderCount(null);

    void fetch("/api/buyer/orders/items?page=1", { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as ItemsResponse;
        if (!response.ok) throw new Error(result.error || "Purchased items could not be loaded.");
        if (!active) return;
        setItems(result.items);
        setHasMore(result.hasMore);
        setInProgressOrderCount(result.inProgressOrderCount);
        setPage(1);
      })
      .catch((fetchError: unknown) => {
        if (!active || (fetchError instanceof Error && fetchError.name === "AbortError")) return;
        console.error("Failed to load purchased items:", fetchError);
        setError(fetchError instanceof Error ? fetchError.message : "Purchased items could not be loaded.");
      })
      .finally(() => {
        if (active) {
          loadingRef.current = false;
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [retryVersion]);

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMore || page === 0) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/buyer/orders/items?page=${page + 1}`);
      const result = await response.json() as ItemsResponse;
      if (!response.ok) throw new Error(result.error || "More purchased items could not be loaded.");
      setItems((current) => [...current, ...result.items]);
      setHasMore(result.hasMore);
      setInProgressOrderCount(result.inProgressOrderCount);
      setPage((current) => current + 1);
    } catch (fetchError) {
      console.error("Failed to load more purchased items:", fetchError);
      setError(fetchError instanceof Error ? fetchError.message : "More purchased items could not be loaded.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, page]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || page === 0) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadNextPage();
    }, { rootMargin: "400px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadNextPage, page]);

  useEffect(() => {
    if (!loading && !error && items.length === 0 && hasMore && page > 0) {
      void loadNextPage();
    }
  }, [error, hasMore, items.length, loadNextPage, loading, page]);

  const retry = useCallback(() => setRetryVersion((version) => version + 1), []);

  if (loading && items.length === 0) {
    return (
      <div className="space-y-3" aria-label="Loading purchased items" aria-live="polite">
        {Array.from({ length: 4 }, (_, index) => <ItemSkeleton key={index} />)}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-6 text-center">
        <p className="font-semibold text-danger-text">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!loading && !error && items.length === 0 && !hasMore) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
        <Package className="mx-auto h-10 w-10 text-muted" aria-hidden="true" />
        <p className="mt-3 text-lg font-semibold text-text">You haven&apos;t bought anything yet</p>
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

  if (!loading && !error && items.length === 0 && hasMore) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <p className="sr-only">Loading more purchased items.</p>
        {[0, 1].map((index) => <ItemSkeleton key={index} />)}
      </div>
    );
  }

  return (
    <section aria-label="Purchased products" className="min-w-0 space-y-3">
      {inProgressOrderCount !== null && inProgressOrderCount > 0 && (
        <p className="text-sm text-muted" aria-live="polite">
          {inProgressOrderCount} {inProgressOrderCount === 1 ? "order" : "orders"} in progress
        </p>
      )}
      {items.map((item) => (
        <PurchasedItemRow key={item.id} item={item} />
      ))}
      {loading && (
        <div className="space-y-3" aria-label="Loading more purchased items" aria-live="polite">
          {[0, 1].map((index) => <ItemSkeleton key={index} />)}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-4">
          <p className="text-sm text-danger-text">{error}</p>
          <button type="button" onClick={() => void loadNextPage()} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-danger/40 px-4 text-sm font-semibold text-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Try again
          </button>
        </div>
      )}
      <div ref={loadMoreRef} className="h-2" aria-hidden="true" />
      {!hasMore && items.length > 0 && (
        <p className="py-3 text-center text-sm text-muted">You&apos;re all caught up.</p>
      )}
    </section>
  );
}

function PurchasedItemRow({ item }: { item: PurchasedItem }) {
  const trackerHref = `/buyer/orders/${item.order_id}/track?item=${encodeURIComponent(item.id)}`;

  return (
    <Link
      href={trackerHref}
      className="grid min-h-[156px] min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg border border-border bg-surface p-3 shadow-sm transition-colors hover:border-accent/50 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[112px] sm:grid-cols-[72px_minmax(0,1fr)_repeat(4,minmax(64px,auto))_auto] sm:items-center sm:gap-4 sm:p-4"
    >
      <div className="row-span-2 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-bg sm:row-span-1">
        {item.product_image ? (
          <img src={item.product_image} alt="" className="h-full w-full object-cover" />
        ) : (
          <Package className="h-6 w-6 text-muted" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 self-end sm:self-center">
        <p className="truncate font-semibold text-text" title={item.product_name}>{item.product_name}</p>
        <p className="mt-1 truncate text-xs text-muted">Order #{item.order_id.slice(0, 8)}</p>
      </div>
      <div className="col-start-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 text-xs sm:col-start-auto sm:contents">
        <p className="truncate text-muted" title={[item.selected_size && `Size: ${item.selected_size}`, item.selected_color && `Color: ${item.selected_color}`].filter(Boolean).join(" · ") || undefined}>
          {[item.selected_size && `Size: ${item.selected_size}`, item.selected_color && `Color: ${item.selected_color}`]
            .filter(Boolean)
            .join(" · ") || "Variant not recorded"}
        </p>
        <p className="text-muted">Qty {item.quantity}</p>
        <p className="font-semibold text-text">₦{Number(item.price_at_purchase).toLocaleString()}</p>
        <span className={`inline-flex min-h-6 w-fit items-center rounded-full px-2.5 text-xs font-semibold ${statusColor(item.order_status)}`}>
          {statusLabel(item.order_status)}
        </span>
      </div>
      <span className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-on sm:col-span-1">
        Track
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}
