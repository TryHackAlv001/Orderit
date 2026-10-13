'use client';

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Pencil, ShoppingCart, ShieldCheck } from "lucide-react";
import { RatingSummary } from "./RatingSummary";
import { formatCurrency, getCurrencyOption } from "@/constants";
import { useCurrencyStore } from "@/store/currencyStore";
import { useAuthStore } from "@/store/authStore";
import { useAddToCart } from "@/hooks/useAddToCart";
import { isOwnProduct } from "@/lib/is-own-product";
import type { Product } from "@/types";

type MarketplaceProduct = Product & {
  short_description?: string | null;
  vendor: { id?: string; full_name: string; logo_url?: string; is_verified?: boolean };
  variants?: { id: string; color: string | null; size: string | null; stock_quantity: number }[];
  variantsLoaded?: boolean;
};

interface ProductCardProps {
  product: MarketplaceProduct;
  variant?: "default" | "home" | "masonry";
  imagePriority?: boolean;
  imageFetchPriority?: "high" | "low" | "auto";
}

function getCardDescription(product: MarketplaceProduct) {
  const description = product.short_description?.trim() || product.description?.trim() || "";
  const firstSentence = description.match(/^.*?[.!?](?:\s|$)/)?.[0];
  return (firstSentence ?? description).trim();
}

export function ProductCard({
  product,
  variant = "default",
  imagePriority = false,
  imageFetchPriority,
}: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState(3 / 4);
  const lastAddAt = useRef(0);
  const user = useAuthStore((state) => state.user);
  const addCartItem = useAddToCart();
  const currency = getCurrencyOption(useCurrencyStore((state) => state.currency));
  const variants = product.variants ?? [];
  const activeVariants = variants.filter((productVariant) => productVariant.stock_quantity > 0);
  const variantDataKnown = product.variantsLoaded !== false;
  const isOutOfStock = !variantDataKnown || (variants.length > 0
    ? activeVariants.length === 0
    : product.stock_quantity <= 0);
  const reviewCount = Number(product.review_count) || 0;
  const rating = Number(product.rating) || 0;
  const description = getCardDescription(product);
  const isOwnListing = isOwnProduct(product.vendor_id, user?.id);

  const addToCart = async () => {
    if (isOwnListing || isOutOfStock) return;
    const now = Date.now();
    if (now - lastAddAt.current < 300) return;
    lastAddAt.current = now;
    const needsSelection = activeVariants.length > 1;
    const selectedVariant = activeVariants.length === 1 ? activeVariants[0] : null;
    const succeeded = await addCartItem({
      id: product.id,
      product,
      quantity: 1,
      variant_id: selectedVariant?.id ?? null,
      needs_selection: needsSelection,
      active_variant_count_at_add: activeVariants.length,
      price_at_add: Number(product.price),
      selected_size: selectedVariant?.size ?? null,
      selected_color: selectedVariant?.color ?? null,
      vendor: {
        id: product.vendor.id ?? product.vendor_id,
        shop_name: product.vendor.full_name || "Vendor Store",
      },
    });
    if (succeeded) {
      setAdded(true);
      window.setTimeout(() => setAdded(false), 800);
    }
  };

  return (
    <article data-product-id={product.id} className="group relative min-w-0">
      <Link href={`/product/${product.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div
          className={`relative overflow-hidden ${variant === "masonry" ? "aspect-[3/4] md:aspect-auto" : "aspect-square"} ${variant === "home" ? "rounded-md" : "rounded-lg"} bg-surface-raised`}
          style={variant === "masonry" ? { aspectRatio: imageAspectRatio } : undefined}
        >
          {product.images?.[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              priority={imagePriority}
              fetchPriority={imageFetchPriority}
              sizes={variant === "masonry"
                ? "(max-width: 767px) 50vw, (max-width: 1055px) 50vw, 512px"
                : "(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1535px) 25vw, 20vw"}
              onLoad={variant === "masonry" ? (event) => {
                if (!window.matchMedia("(min-width: 768px)").matches) return;
                const image = event.currentTarget;
                if (image.naturalHeight > 0) {
                  setImageAspectRatio(Math.min(4 / 3, Math.max(3 / 4, image.naturalWidth / image.naturalHeight)));
                }
              } : undefined}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">No image</div>
          )}
        </div>
        <p className="mt-2 truncate text-sm text-text" title={description || undefined}>
          {description || product.name}
        </p>
      </Link>

      {variant === "masonry" && reviewCount > 0 && (
        <Link href={`/product/${product.id}`} className="mt-1 block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RatingSummary rating={rating} reviewCount={reviewCount} size="sm" showCount />
        </Link>
      )}
      {variant === "masonry" && product.brand?.trim() && product.brand.trim().toLowerCase() !== "unspecified" && (
        <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
          {product.brand.trim()}
        </span>
      )}

      <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
        <Link href={`/product/${product.id}`} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 overflow-hidden rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0 truncate whitespace-nowrap text-base font-bold text-text">
            {formatCurrency(Number(product.price), currency.code, currency.locale)}
          </span>
          {product.compare_price && Number(product.compare_price) > Number(product.price) && (
            <span className="text-xs text-muted line-through">
              {formatCurrency(Number(product.compare_price), currency.code, currency.locale)}
            </span>
          )}
        </Link>
        <div className="relative shrink-0">
          {isOwnListing ? (
            <Link
              href={`/vendor/products/${product.id}/edit`}
              title="Edit your product"
              aria-label="Edit product"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text hover:border-accent hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pencil className="h-5 w-5" aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              disabled={isOutOfStock}
              aria-label="Add to cart"
              onClick={() => void addToCart()}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text hover:border-accent hover:text-accent-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {added
                ? <Check className="h-5 w-5" aria-hidden="true" />
                : <ShoppingCart className="h-5 w-5" aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>

      {variant === "default" && (
        <>
          <Link href={`/product/${product.id}`} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {!isOutOfStock && product.stock_quantity <= 10 && (
              <p className="mt-1 text-xs font-semibold text-accent-text">Only {product.stock_quantity} left</p>
            )}
            {reviewCount > 0 && (
              <div className="mt-1">
                <RatingSummary rating={rating} reviewCount={reviewCount} size="sm" showCount />
              </div>
            )}
            {(product.vendor.is_verified || (product.brand?.trim() && product.brand.trim().toLowerCase() !== "unspecified")) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {product.vendor.is_verified && (
                  <span className="inline-flex items-center gap-1 text-accent-text">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Verified vendor
                  </span>
                )}
                {product.brand?.trim() && product.brand.trim().toLowerCase() !== "unspecified" && <span>{product.brand.trim()}</span>}
              </div>
            )}
          </Link>
          {product.vendor.id && product.vendor.full_name && (
            <Link
              href={`/vendor/${product.vendor.id}/store`}
              className="mt-1 block truncate text-xs text-muted hover:text-text focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={`View ${product.vendor.full_name}'s storefront`}
            >
              by {product.vendor.full_name}
            </Link>
          )}
        </>
      )}
        <span className="sr-only" aria-live="polite">{added ? "Added to cart" : ""}</span>
    </article>
  );
}
