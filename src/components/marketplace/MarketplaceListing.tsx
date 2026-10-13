"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { LOCATIONS } from "@/constants";
import { ALL_SIZE_OPTIONS, getSizeConfig } from "@/constants/sizes";
import { ProductGrid, type MarketplaceGridProduct } from "@/components/marketplace/ProductGrid";
import {
  loadMarketplaceProducts,
  type MarketplaceSearchVendor,
} from "@/components/marketplace/marketplace-data";

const PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price low to high" },
  { value: "price_desc", label: "Price high to low" },
  { value: "newest", label: "Newest" },
];

interface SearchFilters {
  q: string;
  category: string[];
  minPrice: string;
  maxPrice: string;
  state: string;
  rating: string;
  inStock: boolean;
  brand: string;
  color: string;
  size: string;
  sort: string;
  page: number;
}

interface SearchOptions {
  categories: { id: string; name: string; slug: string }[];
  colors: string[];
  brands: string[];
}

function filtersFromParams(params: URLSearchParams): SearchFilters {
  const requestedPage = Number(params.get("page") ?? "1");
  return {
    q: params.get("q") ?? "",
    category: (params.get("category") ?? "").split(",").filter(Boolean),
    minPrice: params.get("min") ?? "",
    maxPrice: params.get("max") ?? "",
    state: params.get("state") ?? "",
    rating: params.get("rating") ?? "",
    inStock: params.get("inStock") === "true",
    brand: params.get("brand") ?? "",
    color: params.get("color") ?? "",
    size: params.get("size") ?? "",
    sort: params.get("sort") ?? "relevance",
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

function queryFromFilters(filters: SearchFilters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category.length) params.set("category", filters.category.join(","));
  if (filters.minPrice) params.set("min", filters.minPrice);
  if (filters.maxPrice) params.set("max", filters.maxPrice);
  if (filters.state) params.set("state", filters.state);
  if (filters.rating) params.set("rating", filters.rating);
  if (filters.inStock) params.set("inStock", "true");
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.color) params.set("color", filters.color);
  if (filters.size) params.set("size", filters.size);
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryString = searchParams.toString();
  const [filters, setFilters] = useState(() => filtersFromParams(new URLSearchParams(queryString)));
  const [options, setOptions] = useState<SearchOptions>({ categories: [], colors: [], brands: [] });
  const [products, setProducts] = useState<MarketplaceGridProduct[]>([]);
  const [vendors, setVendors] = useState<MarketplaceSearchVendor[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterDialogRef = useRef<HTMLElement>(null);
  const loadedProductsRef = useRef<MarketplaceGridProduct[]>([]);

  useEffect(() => {
    setFilters(filtersFromParams(new URLSearchParams(queryString)));
  }, [queryString]);

  useEffect(() => {
    if (!filters.q.trim()) setMobileFiltersOpen(false);
  }, [filters.q]);

  useEffect(() => {
    if (!mobileFiltersOpen || !filterDialogRef.current) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = filterDialogRef.current;
    const getFocusableElements = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    getFocusableElements()[0]?.focus();

    const handleDialogKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileFiltersOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusableElements();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeydown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeydown);
      previousFocus?.focus();
    };
  }, [mobileFiltersOpen]);

  const navigateWithFilters = useCallback((next: SearchFilters, replace = false) => {
    if (next.page === 1) {
      loadedProductsRef.current = [];
      setProducts([]);
      setVendors([]);
      setHasMore(true);
    }
    setFilters(next);
    const query = queryFromFilters(next);
    const url = query ? `${pathname}?${query}` : pathname;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }, [pathname, router]);

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    navigateWithFilters({ ...filters, [key]: value, page: 1 });
  };

  const clearAll = () => {
    navigateWithFilters({
      q: "",
      category: [],
      minPrice: "",
      maxPrice: "",
      state: "",
      rating: "",
      inStock: false,
      brand: "",
      color: "",
      size: "",
      sort: "relevance",
      page: 1,
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    const params = queryFromFilters(filters);
    setLoading(true);
    setError(null);
    setRequestError(null);

    const loadPage = async () => {
      const result = await loadMarketplaceProducts(new URLSearchParams(params), controller.signal);
      if (controller.signal.aborted) return;
      setError(result.warning);
      const nextProducts = filters.page === 1
        ? result.products
        : [
          ...loadedProductsRef.current,
          ...result.products.filter((product) =>
            !loadedProductsRef.current.some((item) => item.id === product.id)
          ),
        ];
      loadedProductsRef.current = nextProducts;
      setProducts(nextProducts);
      setVendors(result.vendors);
      const lastResultPage = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE));
      setHasMore(filters.page < lastResultPage);
      setOptions(result.options ?? { categories: [], colors: [], brands: [] });

      const categoryIds = filters.category.map((category) =>
        result.options?.categories?.find((option: SearchOptions["categories"][number]) =>
          option.name.toLowerCase() === category.toLowerCase()
        )?.id ?? category
      );
      if (categoryIds.some((category, index) => category !== filters.category[index])) {
        navigateWithFilters({ ...filters, category: categoryIds }, true);
      }
    };

    loadPage()
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name === "AbortError") return;
        setRequestError(fetchError instanceof Error ? fetchError.message : "Unable to search products.");
        if (filters.page === 1) {
          setProducts([]);
          setVendors([]);
          loadedProductsRef.current = [];
        }
        setHasMore(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, navigateWithFilters]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; remove: () => void }[] = [];
    if (filters.q) chips.push({ key: "q", label: `Search: ${filters.q}`, remove: () => updateFilter("q", "") });
    filters.category.forEach((categoryId) => {
      const category = options.categories.find((item) => item.id === categoryId);
      if (category) chips.push({
        key: `category-${categoryId}`,
        label: category.name,
        remove: () => updateFilter("category", filters.category.filter((item) => item !== categoryId)),
      });
    });
    if (filters.minPrice || filters.maxPrice) {
      chips.push({
        key: "price",
        label: `Price: ${filters.minPrice || "0"} – ${filters.maxPrice || "Any"}`,
        remove: () => navigateWithFilters({ ...filters, minPrice: "", maxPrice: "", page: 1 }),
      });
    }
    if (filters.brand) chips.push({ key: "brand", label: `Brand: ${filters.brand}`, remove: () => updateFilter("brand", "") });
    if (filters.color) chips.push({ key: "color", label: `Color: ${filters.color}`, remove: () => updateFilter("color", "") });
    if (filters.size) chips.push({ key: "size", label: `Size: ${filters.size}`, remove: () => updateFilter("size", "") });
    if (filters.sort !== "relevance") {
      const selectedSort = SORT_OPTIONS.find((option) => option.value === filters.sort);
      if (selectedSort) {
        chips.push({
          key: "sort",
          label: `Sort: ${selectedSort.label}`,
          remove: () => updateFilter("sort", "relevance"),
        });
      }
    }
    if (filters.state) chips.push({ key: "state", label: filters.state, remove: () => updateFilter("state", "") });
    if (filters.rating) chips.push({ key: "rating", label: `${filters.rating}+ stars`, remove: () => updateFilter("rating", "") });
    if (filters.inStock) chips.push({ key: "stock", label: "In stock", remove: () => updateFilter("inStock", false) });
    return chips;
  }, [filters, options.categories]);

  const selectedCategories = filters.category
    .map((id) => options.categories.find((item) => item.id === id))
    .filter((category): category is SearchOptions["categories"][number] => Boolean(category));
  const selectedSizeConfigs = selectedCategories.map((category) => getSizeConfig(category.slug || category.name))
    .filter((config) => config.type !== "none");
  const sizeFilterOptions = selectedSizeConfigs.length
    ? Array.from(new Set(selectedSizeConfigs.flatMap((config) => config.options)))
    : selectedCategories.length
      ? []
      : ALL_SIZE_OPTIONS;
  const measurementOnlyFilter = selectedSizeConfigs.length > 0 &&
    selectedSizeConfigs.every((config) => Boolean(config.measurement) && config.options.length === 0);
  const sizeFilterLabel = selectedSizeConfigs.length === 1
    ? selectedSizeConfigs[0].label
    : "Size";

  const filterControls = (idPrefix: string) => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Filters</h2>
        <button type="button" onClick={clearAll} className="text-sm font-semibold text-accent-text transition-colors duration-200 hover:text-accent-text hover:underline">Clear all</button>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-brand`} className="mb-2 block text-sm font-medium text-text">Brand</label>
        <select id={`${idPrefix}-brand`} value={filters.brand} onChange={(event) => updateFilter("brand", event.target.value)} className={selectClass}>
          <option value="">All brands</option>
          {options.brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
        </select>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-text">Price range (₦)</p>
        <div className="flex gap-2">
          <input aria-label="Minimum price" type="number" min="0" placeholder="Min" value={filters.minPrice} onChange={(event) => updateFilter("minPrice", event.target.value)} className={selectClass} />
          <input aria-label="Maximum price" type="number" min="0" placeholder="Max" value={filters.maxPrice} onChange={(event) => updateFilter("maxPrice", event.target.value)} className={selectClass} />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-color`} className="mb-2 block text-sm font-medium text-text">Color</label>
        <select id={`${idPrefix}-color`} value={filters.color} onChange={(event) => updateFilter("color", event.target.value)} className={selectClass}>
          <option value="">All colors</option>
          {options.colors.map((color) => <option key={color} value={color}>{color}</option>)}
        </select>
      </div>
      {(!selectedCategories.length || selectedSizeConfigs.length > 0) && <div>
        <label htmlFor={`${idPrefix}-size`} className="mb-2 block text-sm font-medium text-text">{sizeFilterLabel}</label>
        {measurementOnlyFilter ? (
          <input id={`${idPrefix}-size`} value={filters.size}
            onChange={(event) => updateFilter("size", event.target.value)}
            placeholder="e.g. 120 x 60 x 75 cm" className={selectClass} />
        ) : (
          <select id={`${idPrefix}-size`} value={filters.size}
            onChange={(event) => updateFilter("size", event.target.value)} className={selectClass}>
            <option value="">All sizes</option>
            {sizeFilterOptions.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        )}
      </div>}
      <div>
        <label htmlFor={`${idPrefix}-state`} className="mb-2 block text-sm font-medium text-text">Location</label>
        <select id={`${idPrefix}-state`} value={filters.state} onChange={(event) => updateFilter("state", event.target.value)} className={selectClass}>
          <option value="">All states</option>
          {LOCATIONS.map((location) => <option key={location} value={location}>{location}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-rating`} className="mb-2 block text-sm font-medium text-text">Minimum rating</label>
        <select id={`${idPrefix}-rating`} value={filters.rating} onChange={(event) => updateFilter("rating", event.target.value)} className={selectClass}>
          <option value="">Any rating</option>
          {[4, 3, 2, 1].map((rating) => <option value={rating} key={rating}>{rating}+ stars</option>)}
        </select>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-text">Categories</p>
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {options.categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={filters.category.includes(category.id)}
                onChange={(event) => navigateWithFilters({
                  ...filters,
                  category: event.target.checked
                    ? [...filters.category, category.id]
                    : filters.category.filter((id) => id !== category.id),
                  size: "",
                  page: 1,
                })} />
              {category.name}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={filters.inStock} onChange={(event) => updateFilter("inStock", event.target.checked)} />
        In stock only
      </label>
    </div>
  );

  const filterPillClass = "h-10 shrink-0 rounded-full border border-border bg-surface px-4 text-sm font-medium text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const pillSelectClass = "h-10 max-w-48 appearance-none rounded-full border border-border bg-surface py-2 pl-4 pr-9 text-sm font-medium text-text hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const heading = filters.q
    ? `Results for “${filters.q}”`
    : selectedCategories.length === 1
      ? selectedCategories[0].name
    : "Explore your interests";
  const hasSearchQuery = Boolean(filters.q.trim());

  return (
    <div className="w-full px-0 py-4 sm:py-6">
      {hasSearchQuery && <section aria-label="Product filters" className="mb-6">
        {loading && options.categories.length === 0 ? (
          <div className="flex gap-2 overflow-hidden py-1" aria-label="Loading filters">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-surface-raised" />
            ))}
          </div>
        ) : (
          <div className="relative">
            <div
              ref={filterScrollRef}
              tabIndex={0}
              aria-label="Scrollable product filters"
              className="flex gap-2 overflow-x-auto py-1 pr-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <button ref={filterTriggerRef} type="button" onClick={() => setMobileFiltersOpen(true)} className={`${filterPillClass} inline-flex items-center gap-2`}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filters
              </button>
              <button
                type="button"
                disabled
                title="Deal filtering is unavailable until the catalog search supports it."
                aria-label="Deals filter unavailable"
                className={`${filterPillClass} cursor-not-allowed opacity-55`}
              >
                Deals
              </button>
              <label className="relative flex shrink-0 items-center">
                <span className="sr-only">Sort by</span>
                <select
                  aria-label="Sort by"
                  value={filters.sort}
                  onChange={(event) => updateFilter("sort", event.target.value)}
                  className={pillSelectClass}
                >
                  {SORT_OPTIONS.map((option) => <option value={option.value} key={option.value}>
                    {option.value === "relevance" ? "Sort by: Relevance" : option.label}
                  </option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" aria-hidden="true" />
              </label>
              <label className="relative flex shrink-0 items-center">
                <span className="sr-only">Category</span>
                <select
                  aria-label="Category"
                  value={filters.category[0] ?? ""}
                  onChange={(event) => updateFilter("category", event.target.value ? [event.target.value] : [])}
                  className={`${pillSelectClass} ${filters.category.length ? "border-accent bg-accent text-accent-on" : ""}`}
                >
                  <option value="">Category</option>
                  {options.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" aria-hidden="true" />
              </label>
              <label className="relative flex shrink-0 items-center">
                <span className="sr-only">Color</span>
                <select
                  aria-label="Color"
                  value={filters.color}
                  onChange={(event) => updateFilter("color", event.target.value)}
                  className={`${pillSelectClass} ${filters.color ? "border-accent bg-accent text-accent-on" : ""}`}
                >
                  <option value="">Color</option>
                  {options.colors.map((color) => <option key={color} value={color}>{color}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" aria-hidden="true" />
              </label>
              {(!selectedCategories.length || selectedSizeConfigs.length > 0) && (
                <label className="relative flex shrink-0 items-center">
                  <span className="sr-only">{sizeFilterLabel}</span>
                  {measurementOnlyFilter ? (
                    <input
                      aria-label={sizeFilterLabel}
                      value={filters.size}
                      onChange={(event) => updateFilter("size", event.target.value)}
                      placeholder={sizeFilterLabel}
                      className={`${pillSelectClass} ${filters.size ? "border-accent bg-accent text-accent-on" : ""}`}
                    />
                  ) : (
                    <select
                      aria-label={sizeFilterLabel}
                      value={filters.size}
                      onChange={(event) => updateFilter("size", event.target.value)}
                      className={`${pillSelectClass} ${filters.size ? "border-accent bg-accent text-accent-on" : ""}`}
                    >
                      <option value="">{sizeFilterLabel}</option>
                      {sizeFilterOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  )}
                  {!measurementOnlyFilter && <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" aria-hidden="true" />}
                </label>
              )}
              <label className="relative flex shrink-0 items-center">
                <span className="sr-only">Brand</span>
                <select
                  aria-label="Brand"
                  value={filters.brand}
                  onChange={(event) => updateFilter("brand", event.target.value)}
                  className={`${pillSelectClass} ${filters.brand ? "border-accent bg-accent text-accent-on" : ""}`}
                >
                  <option value="">Brand</option>
                  {options.brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4" aria-hidden="true" />
              </label>
              <details className="relative shrink-0">
                <summary className={`${filterPillClass} flex cursor-pointer list-none items-center gap-2 ${filters.minPrice || filters.maxPrice ? "border-accent bg-accent text-accent-on" : ""}`}>
                  Price <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </summary>
                <div className="absolute left-0 top-full z-sticky mt-2 flex w-[min(18rem,calc(100vw-2rem))] gap-2 rounded-xl border border-border bg-surface p-4 shadow-lg">
                  <input aria-label="Minimum price in naira" type="number" min="0" placeholder="Min ₦" value={filters.minPrice} onChange={(event) => updateFilter("minPrice", event.target.value)} className={selectClass} />
                  <input aria-label="Maximum price in naira" type="number" min="0" placeholder="Max ₦" value={filters.maxPrice} onChange={(event) => updateFilter("maxPrice", event.target.value)} className={selectClass} />
                </div>
              </details>
            </div>
            <button
              type="button"
              aria-label="Scroll filter options right"
              onClick={() => filterScrollRef.current?.scrollBy({ left: 320, behavior: "smooth" })}
              className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-text shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </section>}

      <div className="mb-4 flex justify-center">
        <h1 className="mx-auto max-w-full break-words text-balance text-center text-[19px] font-medium leading-tight tracking-tight text-text sm:text-[23px]">
          {heading}
        </h1>
      </div>

      {activeChips.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {activeChips.map((chip) => (
            <button key={chip.key} type="button" onClick={chip.remove}
              className="inline-flex min-h-11 items-center gap-1 rounded-md bg-accent/10 px-3 py-1.5 text-sm text-text">
              {chip.label}<X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}
          <button type="button" onClick={clearAll} className="ml-1 inline-flex min-h-11 items-center text-sm font-semibold text-muted underline">Clear all</button>
        </div>
      )}

      {error && <div role="status" className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger-text">{error}</div>}

      {hasSearchQuery && (
        <section aria-labelledby="vendor-search-results-heading" className="mb-8">
          <h2 id="vendor-search-results-heading" className="mb-4 text-xl font-semibold text-text">
            Vendors
          </h2>
          {vendors.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vendors.map((vendor) => (
                <Link
                  key={vendor.id}
                  href={`/vendor/${vendor.id}/store`}
                  className="flex min-w-0 gap-4 rounded-xl border border-border bg-surface p-5 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {vendor.logo_url ? (
                    <Image
                      src={vendor.logo_url}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-raised text-lg font-semibold text-text">
                      {vendor.shop_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-text">{vendor.shop_name}</span>
                    {vendor.location && <span className="mt-1 block text-xs text-muted">{vendor.location}</span>}
                    {vendor.shop_description && <span className="mt-2 line-clamp-2 block text-sm text-muted">{vendor.shop_description}</span>}
                    {vendor.is_verified && <span className="mt-2 inline-block text-xs font-semibold text-accent-text">Verified vendor</span>}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No matching vendors found.</p>
          )}
        </section>
      )}

      <section aria-label="Product listings">
        <ProductGrid
          products={products}
          loading={loading}
          error={requestError}
          hasMore={hasMore}
          onLoadMore={() => navigateWithFilters({ ...filters, page: filters.page + 1 })}
          emptyMessage="Try changing or clearing your filters."
          emptyActionLabel="Clear all filters"
          onEmptyAction={clearAll}
        />
      </section>

      {hasSearchQuery && mobileFiltersOpen && (
        <div className="fixed inset-0 z-overlay-menu bg-background/55" onClick={() => setMobileFiltersOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Product filters"
            className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-surface p-5 pb-8 shadow-2xl sm:p-7"
            ref={filterDialogRef}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <span className="text-sm text-muted">Filters</span>
              <button type="button" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)}
                className="rounded-md p-2 text-muted hover:bg-surface-raised"><X className="h-5 w-5" /></button>
            </div>
            {filterControls("drawer")}
            <button type="button" onClick={() => setMobileFiltersOpen(false)}
              className="mt-6 w-full rounded-full bg-accent px-5 py-3 font-semibold text-accent-on">
              Show results
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

const selectClass = "min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring";

export function MarketplaceListing() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading search…</div>}>
      <SearchContent />
    </Suspense>
  );
}

export default MarketplaceListing;
