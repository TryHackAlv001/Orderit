'use client';

import { useState } from "react";
import Link from "next/link";
import { CirclePlus, ShieldCheck, X } from "lucide-react";
import { RatingSummary } from "./RatingSummary";
import { useCartStore } from "@/store/cartStore";
import { formatCurrency, getCurrencyOption } from "@/constants";
import { useCurrencyStore } from "@/store/currencyStore";
import type { Product } from "@/types";

type MarketplaceProduct = Product & {
  short_description?: string | null;
  vendor: { id?: string; full_name: string; logo_url?: string; is_verified?: boolean };
  variants?: { color: string | null; size: string | null; stock_quantity: number }[];
  variantsLoaded?: boolean;
};

interface ProductCardProps {
  product: MarketplaceProduct;
  variant?: "default" | "home";
}

function getCardDescription(product: MarketplaceProduct) {
  const description = product.short_description?.trim() || product.description?.trim() || "";
  const firstSentence = description.match(/^.*?[.!?](?:\s|$)/)?.[0];
  return (firstSentence ?? description).trim();
}

export function ProductCard({ product, variant = "default" }: ProductCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const currency = getCurrencyOption(useCurrencyStore((state) => state.currency));
  const variantDataKnown = product.variantsLoaded !== false;
  const stockedVariants = product.variants?.filter((variant) => variant.stock_quantity > 0) ?? [];
  const availableSizes = Array.from(new Set(stockedVariants.map((variant) => variant.size).filter((size): size is string => Boolean(size))));
  const colors = Array.from(new Set(stockedVariants.map((variant) => variant.color).filter((color): color is string => Boolean(color))));
  const hasSizeOptions = availableSizes.length > 0 || (!product.variants?.length && Boolean(product.available_sizes?.length));
  const requiresVariant = !variantDataKnown || colors.length > 0 || stockedVariants.length > 1 ||
    hasSizeOptions || product.size_type === "single" || product.size_type === "multi";
  const isOutOfStock = product.stock_quantity <= 0;
  const reviewCount = Number(product.review_count) || 0;
  const rating = Number(product.rating) || 0;
  const description = getCardDescription(product);

  const addToCart = (size: string | null) => {
    addItem({
      id: product.id,
      product,
      quantity: 1,
      selected_size: size,
      vendor: {
        id: product.vendor_id,
        shop_name: product.vendor.full_name || "Vendor Store",
      },
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
    setPickerOpen(false);
  };

  return (
    <article className="group relative min-w-0">
      <Link href={`/product/${product.id}`} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className={`aspect-square overflow-hidden ${variant === "home" ? "rounded-md" : "rounded-lg"} bg-surface-raised`}>
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
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

      <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
        <Link href={`/product/${product.id}`} className="flex min-w-0 flex-wrap items-baseline gap-x-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="text-base font-bold text-text">
            {formatCurrency(Number(product.price), currency.code, currency.locale)}
          </span>
          {product.compare_price && Number(product.compare_price) > Number(product.price) && (
            <span className="text-xs text-muted line-through">
              {formatCurrency(Number(product.compare_price), currency.code, currency.locale)}
            </span>
          )}
        </Link>
        <div className="relative shrink-0">
          <button
            type="button"
            disabled={isOutOfStock}
            aria-label={requiresVariant ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
            aria-expanded={requiresVariant ? pickerOpen : undefined}
            onClick={() => requiresVariant ? setPickerOpen((open) => !open) : addToCart(null)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text hover:border-accent hover:text-accent-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {pickerOpen ? <X className="h-4 w-4" /> : <CirclePlus className="h-5 w-5" />}
          </button>
          {requiresVariant && pickerOpen && (
            <div role="dialog" aria-label={`Choose options for ${product.name}`} className="absolute bottom-full right-0 z-30 mb-2 w-64 rounded-xl border border-border bg-surface p-4 shadow-lg">
              <p className="mb-3 text-sm font-semibold text-text">Choose an option</p>
              {!variantDataKnown ? (
                <p className="text-sm text-muted">
                  Options could not be loaded.{" "}
                  <Link href={`/product/${product.id}`} className="font-semibold text-accent-text underline">View product</Link>
                </p>
              ) : colors.length > 0 ? (
                <>
                  <label htmlFor={`color-${product.id}`} className="sr-only">Color</label>
                  <select
                    id={`color-${product.id}`}
                    value={selectedColor}
                    onChange={(event) => setSelectedColor(event.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a color</option>
                    {colors.map((color) => <option key={color} value={color}>{color}</option>)}
                  </select>
                  {availableSizes.length > 0 && (
                    <>
                      <label htmlFor={`size-${product.id}`} className="sr-only">Size</label>
                      <select
                        id={`size-${product.id}`}
                        value={selectedSize}
                        onChange={(event) => setSelectedSize(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select a size</option>
                        {availableSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                      </select>
                    </>
                  )}
                  <p className="mt-3 text-xs text-muted">
                    Color choices can&apos;t be saved to cart or checkout yet.
                  </p>
                </>
              ) : hasSizeOptions ? (
                <>
                  <label htmlFor={`size-${product.id}`} className="sr-only">Size</label>
                  <select
                    id={`size-${product.id}`}
                    value={selectedSize}
                    onChange={(event) => setSelectedSize(event.target.value)}
                    className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a size</option>
                    {availableSizes.map((size) => <option key={size} value={size}>{size}</option>)}
                    {availableSizes.length === 0 && product.available_sizes?.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedSize || isOutOfStock}
                    onClick={() => addToCart(selectedSize)}
                    className="mt-3 w-full rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Add to cart
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted">
                  Variant options aren&apos;t available here.{" "}
                  <Link href={`/product/${product.id}`} className="font-semibold text-accent-text underline">View product</Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {variant !== "home" && (
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
        {added && <span className="sr-only" role="status">Added {product.name} to cart</span>}
    </article>
  );
}
