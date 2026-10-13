"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  ClipboardList,
  Headset,
  MessageCircle,
  Settings,
  ShoppingBag,
  Star,
  type LucideIcon,
} from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { useAuth } from "@/hooks/useAuth";
import { loadMarketplaceProducts, type MarketplaceSearchResult } from "@/components/marketplace/marketplace-data";
import { createClient } from "@/lib/supabase/client";
import { isBuyerOrderInProgress } from "@/lib/buyer-orders";

const FEED_PAGE_SIZE = 12;

type HubData = {
  inProgressOrders: number | null;
  unreadCount: number;
  awaitingReviews: number | null;
  hasVendorAccount: boolean;
  vendorPendingOrders: number | null;
};

const EMPTY_HUB_DATA: HubData = {
  inProgressOrders: null,
  unreadCount: 0,
  awaitingReviews: null,
  hasVendorAccount: false,
  vendorPendingOrders: null,
};

function feedSkeleton(index: number) {
  return (
    <div key={index} className="mb-1 break-inside-avoid animate-pulse">
      <div className={`rounded-lg bg-surface-raised ${index % 2 ? "aspect-[4/3]" : "aspect-[3/4]"}`} />
      <div className="mt-2 h-3 w-4/5 rounded bg-surface-raised" />
      <div className="mt-2 h-4 w-2/5 rounded bg-surface-raised" />
      <div className="mt-2 h-9 w-full rounded bg-surface-raised" />
    </div>
  );
}

async function loadFeedPage(page: number, signal: AbortSignal): Promise<MarketplaceSearchResult> {
  const params = new URLSearchParams({ page: String(page) });
  try {
    const result = await loadMarketplaceProducts(params, signal);
    if (page !== 1 || result.products.length > 0) return result;
  } catch (error) {
    if (signal.aborted) throw error;
    const popularParams = new URLSearchParams({ page: String(page), sort: "rating" });
    return loadMarketplaceProducts(popularParams, signal);
  }

  const popularParams = new URLSearchParams({ page: String(page), sort: "rating" });
  return loadMarketplaceProducts(popularParams, signal);
}

function SkeletonHeader() {
  return (
    <div className="flex animate-pulse items-center gap-3" aria-label="Loading profile">
      <div className="h-14 w-14 shrink-0 rounded-full bg-surface-raised" />
      <div className="h-7 min-w-0 flex-1 rounded bg-surface-raised" />
      <div className="h-11 w-11 rounded-full bg-surface-raised" />
      <div className="h-11 w-11 rounded-full bg-surface-raised" />
    </div>
  );
}

function HubRow({
  href,
  icon: Icon,
  label,
  summary,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  summary?: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 min-w-0 items-center gap-3 border-b border-border px-1 py-2 text-text transition-colors hover:bg-surface-raised focus-visible:relative focus-visible:z-sticky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {summary && <span className="text-right text-xs text-muted">{summary}</span>}
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-danger px-2 text-xs font-bold text-danger-text">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
    </Link>
  );
}

export default function ProfileHub() {
  const { user, isLoading: authLoading } = useAuth();
  const [hubData, setHubData] = useState(EMPTY_HUB_DATA);
  const [hubLoading, setHubLoading] = useState(false);
  const [products, setProducts] = useState<Awaited<ReturnType<typeof loadMarketplaceProducts>>["products"]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [retryVersion, setRetryVersion] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadTriggeredRef = useRef(false);

  useEffect(() => {
    const handleUnreadState = (event: Event) => {
      const unreadCount = (event as CustomEvent<{ unreadCount: number }>).detail.unreadCount;
      setHubData((current) => ({ ...current, unreadCount }));
    };
    window.addEventListener("navbar-notifications-state", handleUnreadState);
    return () => window.removeEventListener("navbar-notifications-state", handleUnreadState);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setHubData(EMPTY_HUB_DATA);
      setHubLoading(false);
      return;
    }

    let active = true;
    const supabase = createClient();
    setHubLoading(true);

    const loadHubData = async () => {
      const [buyerOrdersResult, vendorOrdersResult, vendorResult] = await Promise.all([
        supabase.from("orders").select("id,status").eq("buyer_id", user.id),
        supabase.from("orders").select("id,status").eq("vendor_id", user.id),
        supabase.from("vendor_profiles").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (buyerOrdersResult.error) console.error("Unable to load buyer order history:", buyerOrdersResult.error.message);
      if (vendorOrdersResult.error) console.error("Unable to load vendor orders:", vendorOrdersResult.error.message);
      if (vendorResult.error) console.error("Unable to load vendor account:", vendorResult.error.message);

      const buyerOrders = buyerOrdersResult.data ?? [];
      const vendorOrders = vendorOrdersResult.data ?? [];
      const nextData: HubData = {
        inProgressOrders: buyerOrdersResult.error
          ? null
          : buyerOrders.filter((order) => isBuyerOrderInProgress(order.status)).length,
        unreadCount: 0,
        awaitingReviews: user.role === "vendor" ? null : buyerOrdersResult.error ? null : 0,
        hasVendorAccount: Boolean(vendorResult.data),
        vendorPendingOrders: vendorOrdersResult.error
          ? null
          : vendorOrders.filter((order) => order.status === "pending").length,
      };

      if (user.role !== "vendor" && !buyerOrdersResult.error) {
        const deliveredOrderIds = buyerOrders
          .filter((order) => order.status === "delivered")
          .map((order) => order.id);
        if (deliveredOrderIds.length > 0) {
          const { data: purchasedItems, error: itemsError } = await supabase
            .from("order_items")
            .select("product_id")
            .in("order_id", deliveredOrderIds);
          if (itemsError) {
            console.error("Unable to load delivered order items:", itemsError.message);
            nextData.awaitingReviews = null;
          } else {
            const productIds = Array.from(new Set((purchasedItems ?? [])
              .map((item) => item.product_id)
              .filter((productId): productId is string => Boolean(productId))));
            if (productIds.length > 0) {
              const { data: reviews, error: reviewsError } = await supabase
                .from("reviews")
                .select("product_id")
                .eq("buyer_id", user.id)
                .in("product_id", productIds);
              if (reviewsError) {
                console.error("Unable to load account reviews:", reviewsError.message);
                nextData.awaitingReviews = null;
              } else {
                const reviewedProductIds = new Set((reviews ?? []).map((review) => review.product_id));
                nextData.awaitingReviews = productIds.filter((productId) => !reviewedProductIds.has(productId)).length;
              }
            }
          }
        }
      }

      if (active) setHubData((current) => ({ ...nextData, unreadCount: current.unreadCount }));
      if (active) setHubLoading(false);
    };

    void loadHubData();
    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!user?.id) {
      setProducts([]);
      setFeedLoading(false);
      setFeedError(null);
      return;
    }

    const controller = new AbortController();
    setFeedLoading(true);
    setFeedError(null);

    loadFeedPage(page, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProducts((current) => page === 1
          ? result.products
          : [...current, ...result.products.filter((product) => !current.some((item) => item.id === product.id))]);
        setHasMore(page * FEED_PAGE_SIZE < result.totalCount);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) return;
        console.error("Unable to load profile product feed:", error);
        setFeedError(error instanceof Error ? error.message : "Products could not be loaded.");
        setHasMore(false);
        if (page === 1) setProducts([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setFeedLoading(false);
      });

    return () => controller.abort();
  }, [page, retryVersion, user?.id]);

  useEffect(() => {
    if (feedLoading) {
      loadTriggeredRef.current = false;
      return;
    }
    const target = loadMoreRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadTriggeredRef.current) {
        loadTriggeredRef.current = true;
        setPage((current) => current + 1);
      }
    }, { rootMargin: "600px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [feedLoading, hasMore]);

  const retryFeed = useCallback(() => {
    setFeedError(null);
    setHasMore(true);
    setPage(1);
    setRetryVersion((current) => current + 1);
  }, []);

  const profilePicture = user?.avatar_url;
  const displayName = user?.full_name?.trim() || "Welcome";
  const settingsHref = "/settings";
  const stats = [
    ...(user?.role !== "vendor" && hubData.inProgressOrders !== null && hubData.inProgressOrders > 0
      ? [{ value: String(hubData.inProgressOrders), label: "Orders in progress" }]
      : []),
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl pt-[calc(var(--safe-top)+14px)] md:pt-0">
      {authLoading ? (
        <SkeletonHeader />
      ) : !user ? (
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
          <h1 className="text-xl font-bold text-text">Sign in or create an account</h1>
          <p className="mt-2 text-sm text-muted">Sign in to manage orders, messages, and your account.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Sign in
            </Link>
            <Link href="/register" className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Create account
            </Link>
          </div>
        </section>
      ) : (
        <>
          <header className="flex min-w-0 items-center gap-3">
            {profilePicture ? (
              <img src={profilePicture} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-on">
                {(displayName[0] ?? "U").toLocaleUpperCase()}
              </span>
            )}
            <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-text sm:text-2xl" title={displayName}>
              {displayName}
            </h1>
            <Link href="/messages" aria-label="Support" title="Support" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Headset className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link href={settingsHref} aria-label="Settings" title="Settings" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
          </header>

          {hubLoading ? (
            <div className="mt-6 grid animate-pulse grid-cols-2 gap-4" aria-label="Loading account stats">
              <div className="h-16 rounded-lg bg-surface-raised" />
              <div className="h-16 rounded-lg bg-surface-raised" />
            </div>
          ) : stats.length > 0 ? (
            <section aria-label="Account stats" className={`mt-6 grid divide-x divide-border border-y border-border py-4 ${stats.length === 1 ? "grid-cols-1 text-center" : "grid-cols-2"}`}>
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-0 px-3">
                  <p className="truncate text-2xl font-bold text-text">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted">{stat.label}</p>
                </div>
              ))}
            </section>
          ) : null}

          <section aria-label="Account links" className="mt-6">
            {hubLoading ? (
              <div className="animate-pulse divide-y divide-border border-y border-border">
                {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-14 bg-surface-raised/60" />)}
              </div>
            ) : (
              <div className="divide-y divide-border border-y border-border">
                <HubRow
                  href="/buyer/orders?filter=in_progress"
                  icon={ClipboardList}
                  label="Your orders"
                  summary={hubData.inProgressOrders !== null && hubData.inProgressOrders > 0 ? `${hubData.inProgressOrders} in progress` : undefined}
                />
                <HubRow href="/messages" icon={MessageCircle} label="Messages" badge={hubData.unreadCount} />
                {user?.role !== "vendor" && (
                  <HubRow
                    href="/buyer/orders"
                    icon={Star}
                    label="Reviews"
                    summary={hubData.awaitingReviews === null ? undefined : `${hubData.awaitingReviews} awaiting review`}
                  />
                )}
                {hubData.hasVendorAccount && (
                  <HubRow
                    href="/vendor/dashboard"
                    icon={ShoppingBag}
                    label="Vendor dashboard"
                    badge={hubData.vendorPendingOrders ?? undefined}
                  />
                )}
              </div>
            )}
          </section>
        </>
      )}

      {user && (
        <section aria-label="Recommended products" className="mt-8 -mx-4 min-w-0 md:mx-0">
          <h2 className="mb-3 px-4 text-lg font-semibold text-text md:px-0">Recommended for you</h2>
          {feedError && products.length === 0 ? (
            <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-5 py-7 text-center">
              <p className="text-sm text-danger-text">Products could not be loaded: {feedError}</p>
              <button type="button" onClick={retryFeed} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-danger/40 px-5 text-sm font-semibold text-danger-text hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Retry
              </button>
            </div>
          ) : products.length === 0 && feedLoading ? (
            <div className="columns-2 gap-1" aria-label="Loading products">
              {Array.from({ length: 6 }, (_, index) => feedSkeleton(index))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-5 py-7 text-center">
              <p className="text-sm text-muted">No active products are available right now.</p>
              {feedError && <p className="mt-2 text-sm text-danger-text">{feedError}</p>}
              <button type="button" onClick={retryFeed} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Retry
              </button>
            </div>
          ) : (
            <>
              {feedError && (
                <div role="alert" className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger-text">
                  More products could not be loaded: {feedError}
                  <button type="button" onClick={retryFeed} className="ml-3 min-h-11 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Retry
                  </button>
                </div>
              )}
              <div className="columns-2 gap-1">
                {products.map((product, index) => (
                  <div key={product.id} className="mb-1 break-inside-avoid">
                    <ProductCard product={product} variant="masonry" imagePriority={index < 2} />
                  </div>
                ))}
              </div>
              {feedLoading && (
                <div className="mt-2 columns-2 gap-1" aria-label="Loading more products">
                  {Array.from({ length: 4 }, (_, index) => feedSkeleton(index + 2))}
                </div>
              )}
              {hasMore && <div ref={loadMoreRef} aria-hidden="true" className="h-px w-full" />}
              {!hasMore && products.length > 0 && <div className="h-4" />}
            </>
          )}
        </section>
      )}
    </div>
  );
}
