import { useEffect, useRef } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductCardSkeleton } from "@/components/skeletons";
import type { Product } from "@/types";

export type MarketplaceGridProduct = Product & {
  vendor: { id?: string; full_name: string; logo_url?: string; is_verified?: boolean };
  variants?: { id: string; color: string | null; size: string | null; stock_quantity: number }[];
  variantsLoaded?: boolean;
};

interface ProductGridProps {
  products: MarketplaceGridProduct[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  error?: string | null;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  variant?: "default" | "home";
}

export function ProductGrid({
  products,
  loading,
  hasMore,
  onLoadMore,
  error,
  emptyTitle = "No products found",
  emptyMessage = "Try changing your selection.",
  emptyActionLabel,
  onEmptyAction,
  variant = "default",
}: ProductGridProps) {
  const productGridRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadTriggeredRef = useRef(false);

  useEffect(() => {
    if (loading) {
      loadTriggeredRef.current = false;
      return;
    }
    const target = loadMoreRef.current;
    if (!target || !hasMore) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loadTriggeredRef.current) {
        loadTriggeredRef.current = true;
        onLoadMore();
      }
    }, { rootMargin: "600px" });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  if (loading && products.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-x-layout-3 gap-y-layout-8 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" aria-label="Loading products">
        {Array.from({ length: 10 }, (_, index) => <ProductCardSkeleton key={index} variant={variant} />)}
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-6 py-10 text-center">
        <h2 className="text-xl font-semibold text-danger-text">Products could not be loaded</h2>
        <p className="mt-2 text-sm text-danger-text">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <>
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <h2 className="text-xl font-semibold text-text">{emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted">{emptyMessage}</p>
          {emptyActionLabel && onEmptyAction && (
            <button
              type="button"
              onClick={onEmptyAction}
              className="mt-5 min-h-11 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-on focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {emptyActionLabel}
            </button>
          )}
        </div>
        {hasMore && (
          <div className="mt-9 flex flex-col items-center">
            <button
              type="button"
              onClick={() => {
                loadTriggeredRef.current = true;
                onLoadMore();
              }}
              className="rounded-full border border-border bg-surface px-8 py-3 text-sm font-semibold text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Load more
            </button>
            <div ref={loadMoreRef} aria-hidden="true" className="h-px w-full" />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" className="mb-5 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger-text">
          More products could not be loaded: {error}
        </div>
      )}
      <div ref={productGridRef} className="grid grid-cols-2 gap-x-layout-3 gap-y-layout-8 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            variant={variant}
            imagePriority={variant === "home" && index < 2}
            imageFetchPriority={index === 0 ? "high" : undefined}
          />
        ))}
      </div>
      {loading && (
        <div className="mt-7 grid grid-cols-2 gap-x-layout-3 gap-y-layout-8 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5" aria-label="Loading more products">
          {Array.from({ length: 5 }, (_, index) => <ProductCardSkeleton key={index} variant={variant} />)}
        </div>
      )}
      {hasMore && (
        <div className="mt-9 flex flex-col items-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              loadTriggeredRef.current = true;
              onLoadMore();
            }}
            className="rounded-full border border-border bg-surface px-8 py-3 text-sm font-semibold text-text hover:border-accent disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
          <div ref={loadMoreRef} aria-hidden="true" className="h-px w-full" />
        </div>
      )}
    </>
  );
}
