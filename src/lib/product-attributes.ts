import type { SizeType } from "@/constants/sizes";

export interface CatalogOptions {
  categories: { id: string; name: string; slug: string }[];
  categoryRules: {
    category_id: string;
    requires_color: boolean;
    requires_size: boolean;
  }[];
  colors: string[];
  brands: string[];
}

export interface CatalogProductInput {
  name: string;
  description: string;
  category_id: string;
  price: number;
  compare_price: number | null;
  minimum_order: number;
  tags: string[];
  stock_quantity: number;
  sku: string | null;
  is_active: boolean;
  images: string[];
  brand: string;
  size_type: SizeType;
  available_sizes: string[];
  variants: {
    color: string | null;
    size: string | null;
    stock_quantity: number;
  }[];
}

export function isCatalogProductInput(value: unknown): value is CatalogProductInput {
  if (!value || typeof value !== "object") return false;
  const product = value as Record<string, unknown>;
  return (
    typeof product.name === "string" &&
    product.name.trim().length > 0 &&
    typeof product.brand === "string" &&
    product.brand.trim().length > 0 &&
    product.brand.trim().length <= 100 &&
    product.brand.trim().toLowerCase() !== "unspecified" &&
    typeof product.category_id === "string" &&
    product.category_id.length > 0 &&
    (product.size_type === "none" || product.size_type === "single" || product.size_type === "multi") &&
    Array.isArray(product.available_sizes) &&
    product.available_sizes.every((size) => typeof size === "string" && size.trim().length > 0) &&
    typeof product.price === "number" &&
    Number.isFinite(product.price) &&
    product.price > 0 &&
    (product.compare_price === null ||
      (typeof product.compare_price === "number" &&
        Number.isFinite(product.compare_price) &&
        product.compare_price > 0)) &&
    typeof product.minimum_order === "number" &&
    Number.isInteger(product.minimum_order) &&
    product.minimum_order > 0 &&
    typeof product.stock_quantity === "number" &&
    Number.isInteger(product.stock_quantity) &&
    product.stock_quantity >= 0 &&
    typeof product.is_active === "boolean" &&
    Array.isArray(product.images) &&
    product.images.length > 0 &&
    product.images.length <= 5 &&
    product.images.every((image) => typeof image === "string" && image.trim().length > 0) &&
    Array.isArray(product.tags) &&
    product.tags.every((tag) => typeof tag === "string") &&
    Array.isArray(product.variants) &&
    product.variants.every((variant) => {
      if (!variant || typeof variant !== "object") return false;
      const item = variant as Record<string, unknown>;
      return (
        (item.color === null || typeof item.color === "string") &&
        (item.size === null || typeof item.size === "string") &&
        (item.color !== null || item.size !== null) &&
        typeof item.stock_quantity === "number" &&
        Number.isInteger(item.stock_quantity) &&
        item.stock_quantity >= 0
      );
    })
  );
}

export function getMissingCatalogFields(
  product: {
    brand?: string | null;
    category_id?: string | null;
    images?: string[] | null;
    is_complete?: boolean | null;
    price?: number | null;
  },
  rule?: { requires_color: boolean; requires_size: boolean },
  variants: { color: string | null; size: string | null }[] = []
) {
  const missing: string[] = [];
  if (!product.brand?.trim() || product.brand.trim().toLowerCase() === "unspecified") {
    missing.push("brand");
  }
  if (product.price === null || product.price === undefined || !Number.isFinite(Number(product.price)) || Number(product.price) <= 0) {
    missing.push("price");
  }
  if (!product.category_id) missing.push("category");
  if (!product.images?.length) missing.push("image");
  if (rule?.requires_color && !variants.some((variant) => variant.color)) {
    missing.push("color");
  }
  if (rule?.requires_size && !variants.some((variant) => variant.size)) {
    missing.push("size");
  }
  if (product.is_complete === false && missing.length === 0) {
    missing.push("required product details");
  }
  return missing;
}
