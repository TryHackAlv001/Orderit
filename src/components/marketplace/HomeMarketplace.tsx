"use client";

import { useEffect, useState } from "react";
import { HOME_HERO_COPY } from "@/constants";
import { loadMarketplaceProducts } from "@/components/marketplace/marketplace-data";
import { ProductGrid, type MarketplaceGridProduct } from "@/components/marketplace/ProductGrid";

const PAGE_SIZE = 12;

function HomeMarketplaceContent() {
  const [products, setProducts] = useState<MarketplaceGridProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    // TODO: Replace newest active products with a real personalized recommendation query.
    params.set("sort", "newest");

    setLoading(true);
    setWarning(null);
    setRequestError(null);
    loadMarketplaceProducts(params, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProducts((current) => page === 1
          ? result.products
          : [...current, ...result.products.filter((product) => !current.some((item) => item.id === product.id))]);
        setTotalCount(result.totalCount);
        setWarning(result.warning);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        if (controller.signal.aborted) return;
        setRequestError(loadError instanceof Error ? loadError.message : "Products could not be loaded.");
        if (page === 1) {
          setProducts([]);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    }, [page]);

  return (
      <div className="w-full py-3 sm:py-5">
        <header className="mb-5 text-center sm:mb-7">
        {HOME_HERO_COPY.tagline.trim() && (
            <p className="mb-1 text-sm font-semibold text-accent-text sm:text-base">
            {HOME_HERO_COPY.tagline}
          </p>
        )}
          <h1 className="text-2xl font-bold uppercase text-text sm:text-3xl">
          {HOME_HERO_COPY.heading}
        </h1>
      </header>

      {warning && <div role="status" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger-text">{warning}</div>}
        <section id="home-product-grid" aria-label="Newest products">
        <ProductGrid
          products={products}
            loading={loading}
            error={requestError}
          hasMore={products.length < totalCount}
          onLoadMore={() => setPage((current) => current + 1)}
            variant="home"
            emptyTitle="No products yet"
            emptyMessage="New arrivals will appear here as vendors add products."
        />
      </section>
        {totalCount > PAGE_SIZE && <p className="sr-only" aria-live="polite">{products.length} of {totalCount} products loaded</p>}
    </div>
  );
}

export default function HomeMarketplace() {
    return <HomeMarketplaceContent />;
}
