"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface CategoryRecord {
  id: string;
  name: string;
  parent_id: string | null;
}

interface CategoryTreeNode extends CategoryRecord {
  children: CategoryTreeNode[];
  imageUrl: string | null;
  products: CategoryProduct[];
}

interface CategoryProduct {
  id: string;
  name: string;
  images: string[] | null;
}

interface CategoryWithProduct extends CategoryRecord {
  products: CategoryProduct[] | null;
}

interface RailItem {
  id: string | null;
  name: string;
}

const compareCategoriesByName = (left: CategoryRecord, right: CategoryRecord) =>
  left.name.localeCompare(right.name);

function hasActiveProductsInTree(category: CategoryTreeNode): boolean {
  return category.products.length > 0 || category.children.some(hasActiveProductsInTree);
}

async function loadCategories(): Promise<CategoryTreeNode[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,parent_id,products(id,name,images,created_at,is_active)")
    .eq("products.is_active", true)
    .order("name", { ascending: true })
    .order("created_at", { ascending: false, foreignTable: "products" })
    .limit(12, { foreignTable: "products" });

  if (error) throw new Error(`Unable to load categories: ${error.message}`);

  const productsByCategory = new Map<string, CategoryProduct[]>();
  const imageByCategory = new Map<string, string>();
  const categoryRows = ((data ?? []) as CategoryWithProduct[]).map(({ products, ...category }) => {
    const categoryProducts = products ?? [];
    productsByCategory.set(category.id, categoryProducts);
    const primaryImage = categoryProducts[0]?.images?.[0];
    if (primaryImage) imageByCategory.set(category.id, primaryImage);
    return category;
  });
  const childrenByParent = new Map<string, CategoryRecord[]>();
  categoryRows.forEach((category) => {
    if (!category.parent_id) return;
    const children = childrenByParent.get(category.parent_id) ?? [];
    children.push(category);
    childrenByParent.set(category.parent_id, children);
  });

  const buildTree = (category: CategoryRecord, ancestry = new Set<string>()): CategoryTreeNode => {
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(category.id);
    const products = productsByCategory.get(category.id) ?? [];
    const children = (childrenByParent.get(category.id) ?? [])
      .filter((child) => !nextAncestry.has(child.id))
      .sort(compareCategoriesByName)
      .map((child) => buildTree(child, nextAncestry))
      .filter(hasActiveProductsInTree);
    return {
      ...category,
      products,
      children,
      imageUrl: imageByCategory.get(category.id) ?? children.find((child) => child.imageUrl)?.imageUrl ?? null,
    };
  };

  return categoryRows
    .filter((category) => !category.parent_id)
    .sort(compareCategoriesByName)
    .map((category) => buildTree(category))
    .filter(hasActiveProductsInTree);
}

function categoryHref(category: CategoryRecord) {
  return `/marketplace?category=${encodeURIComponent(category.id)}`;
}

function CategoryImage({ category }: { category: CategoryTreeNode }) {
  const [failed, setFailed] = useState(false);
  const initial = category.name.trim().charAt(0).toUpperCase();

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[18px] bg-surface-raised">
      {category.imageUrl && !failed ? (
        <Image
          src={category.imageUrl}
          alt=""
          fill
          loading="lazy"
          sizes="(max-width: 767px) 22vw, (max-width: 1279px) 18vw, 14vw"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center text-2xl font-semibold text-accent-text"
        >
          {initial}
        </span>
      )}
    </div>
  );
}

function CategoryTile({ category, label, href }: {
  category: CategoryTreeNode;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group min-w-0 rounded-[18px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <CategoryImage category={category} />
      <span className="mx-auto mt-2 block max-w-full break-words text-[0.7rem] leading-4 text-text [overflow-wrap:anywhere] group-hover:text-accent-text line-clamp-3">
        {label}
      </span>
    </Link>
  );
}

function ProductTile({ product }: { product: CategoryProduct }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = product.images?.[0];

  return (
    <Link
      href={`/product/${product.id}`}
      className="group min-w-0 rounded-[18px] text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-[18px] bg-surface-raised">
        {imageUrl && !failed ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            loading="lazy"
            sizes="(max-width: 767px) 22vw, (max-width: 1279px) 18vw, 14vw"
            className="object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-2xl font-semibold text-accent-text"
          >
            {product.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="mx-auto mt-2 block max-w-full break-words text-[0.7rem] leading-4 text-text [overflow-wrap:anywhere] group-hover:text-accent-text line-clamp-3">
        {product.name}
      </span>
    </Link>
  );
}

function CategoriesLoadingSkeleton() {
  return (
    <section
      aria-label="Loading categories"
      aria-busy="true"
      className="grid h-[calc(100dvh-var(--mobile-chrome-height)-var(--bottom-nav-height)-var(--space-8))] min-h-0 w-full grid-cols-[minmax(5.25rem,29%)_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-surface md:h-[calc(100dvh-13rem)] lg:grid-cols-[240px_minmax(0,1fr)]"
    >
      <div className="space-y-2 overflow-hidden bg-surface-raised p-2">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
      <div className="min-w-0 overflow-hidden p-3 sm:p-5">
        <div className="mb-5 h-6 w-2/3 animate-pulse rounded bg-surface-raised" />
        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 9 }, (_, index) => (
            <div key={index} className="min-w-0 animate-pulse">
              <div className="aspect-square rounded-[18px] bg-surface-raised" />
              <div className="mx-auto mt-2 h-3 w-3/4 rounded bg-surface-raised" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoriesPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const railButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadCategories()
      .then((nextCategories) => {
        if (!cancelled) setCategories(nextCategories);
      })
      .catch((loadError: unknown) => {
        console.error("Category page load failed:", loadError);
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load categories.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [retryVersion]);

  const selectedId = searchParams.get("c");
  const selectedCategory = categories.find((category) => category.id === selectedId) ?? null;
  const railItems = useMemo<RailItem[]>(
    () => [{ id: null, name: "Featured" }, ...categories.map(({ id, name }) => ({ id, name }))],
    [categories],
  );
  const tiles = useMemo(() => {
    if (!selectedCategory) return categories;
    return selectedCategory.children;
  }, [categories, selectedCategory]);
  const hasActiveProducts = selectedCategory
    ? hasActiveProductsInTree(selectedCategory)
    : categories.length > 0;

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    const selectedKey = selectedCategory?.id ?? "featured";
    railButtonRefs.current.get(selectedKey)?.scrollIntoView({ block: "nearest" });
  }, [selectedCategory?.id, categories.length]);

  const selectRailItem = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("c", id);
    else params.delete("c");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleRailKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + direction + railItems.length) % railItems.length;
    const nextItem = railItems[nextIndex];
    const nextKey = nextItem.id ?? "featured";
    const nextButton = railButtonRefs.current.get(nextKey);
    nextButton?.focus();
    nextButton?.scrollIntoView({ block: "nearest" });
  };

  const selectedForContent = selectedCategory;

  return (
    <section         className="grid h-[calc(100dvh-var(--mobile-chrome-height)-var(--bottom-nav-height)-var(--space-8))] min-h-0 w-full grid-cols-[minmax(5.25rem,29%)_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-bg md:h-[calc(100dvh-13rem)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav
        aria-label="Category selection"
        className="min-h-0 overflow-y-auto overscroll-contain border-r border-border bg-surface-raised"
      >
        <ul className="py-2">
          {railItems.map((item, index) => {
            const active = item.id === (selectedCategory?.id ?? null);
            const key = item.id ?? "featured";
            return (
              <li key={key}>
                <button
                  ref={(element) => {
                    if (element) railButtonRefs.current.set(key, element);
                    else railButtonRefs.current.delete(key);
                  }}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => selectRailItem(item.id)}
                  onKeyDown={(event) => handleRailKeyDown(event, index)}
                  className={`flex min-h-12 w-full items-center break-words border-l-4 px-2 py-3 text-left text-xs leading-4 [overflow-wrap:anywhere] focus-visible:z-sticky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-3 sm:text-sm ${
                    active
                      ? "border-l-accent bg-bg font-semibold text-text"
                      : "border-l-transparent bg-surface-raised font-medium text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  {item.name}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        ref={contentRef}
        className="min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-bg p-3 sm:p-5"
      >
        <h1 className="mb-4 break-words text-lg font-semibold leading-tight text-text sm:mb-6 sm:text-2xl">
          {selectedForContent?.name ?? "Shop by category"}
        </h1>

        {error ? (
          <div role="alert" className="rounded-xl border border-border bg-surface p-5 text-center sm:p-8">
            <p className="mb-4 break-words text-sm text-text">{error}</p>
            <button
              type="button"
              onClick={() => setRetryVersion((version) => version + 1)}
              className="min-h-11 rounded-lg bg-accent px-5 py-2 font-semibold text-accent-on focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div aria-hidden="true" className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: 9 }, (_, index) => (
              <div key={index} className="min-w-0 animate-pulse">
                <div className="aspect-square rounded-[18px] bg-surface-raised" />
                <div className="mx-auto mt-2 h-3 w-3/4 rounded bg-surface-raised" />
              </div>
            ))}
          </div>
        ) : hasActiveProducts ? (
          <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:gap-x-4 sm:gap-y-6 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {selectedForContent && (
              <CategoryTile
                category={selectedForContent}
                label={`All ${selectedForContent.name}`}
                href={categoryHref(selectedForContent)}
              />
            )}
            {tiles.map((category) => (
              <CategoryTile
                key={category.id}
                category={category}
                label={category.name}
                href={categoryHref(category)}
              />
            ))}
            {selectedForContent && tiles.length === 0 && selectedForContent.products.map((product) => (
              <ProductTile key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-5 text-center sm:p-8">
            <p className="mb-4 text-sm text-text">Nothing here yet</p>
            <Link
              href={selectedForContent ? categoryHref(selectedForContent) : "/marketplace"}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-on focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Browse all products
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export default function CategoriesPageClient() {
  return (
    <Suspense fallback={<CategoriesLoadingSkeleton />}>
      <CategoriesPageContent />
    </Suspense>
  );
}
