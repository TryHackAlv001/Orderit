import { createClient } from "@/lib/supabase/client";
import type { MarketplaceGridProduct } from "@/components/marketplace/ProductGrid";

export interface MarketplaceSearchResult {
  products: MarketplaceGridProduct[];
  vendors: MarketplaceSearchVendor[];
  totalCount: number;
  options: {
    categories: { id: string; name: string; slug: string }[];
    colors: string[];
    brands: string[];
  };
  warning: string | null;
}

export interface MarketplaceSearchVendor {
  id: string;
  shop_name: string;
  shop_description: string | null;
  logo_url: string | null;
  location: string | null;
  is_verified: boolean;
}

export async function loadMarketplaceProducts(
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<MarketplaceSearchResult> {
  const query = params.toString();
  const response = await fetch(`/api/products/search${query ? `?${query}` : ""}`, { signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to search products.");

  const products = (result.products ?? []) as MarketplaceGridProduct[];
  const vendors = (result.vendors ?? []) as MarketplaceSearchVendor[];
  const vendorIds = Array.from(new Set(products.map((product) => product.vendor_id)));
  const productIds = products.map((product) => product.id);
  const supabase = createClient();
  const [vendorResult, variantResult] = await Promise.all([
    vendorIds.length
      ? supabase.from("vendor_profiles").select("user_id,is_verified").in("user_id", vendorIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabase.from("product_variants").select("product_id,color,size,stock_quantity").in("product_id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const warnings: string[] = [];
  if (vendorResult.error) {
    console.error("Vendor verification lookup failed:", vendorResult.error.message);
    warnings.push("Vendor verification could not be checked; vendor badges are hidden.");
  }
  if (variantResult.error) {
    console.error("Product variant lookup failed:", variantResult.error.message);
    warnings.push("Variant options could not be loaded; quick add is unavailable.");
  }

  const vendorsById = new Map((vendorResult.data ?? []).map((vendor) => [vendor.user_id, vendor.is_verified]));
  const variantsByProduct = new Map<string, NonNullable<MarketplaceGridProduct["variants"]>>();
  (variantResult.data ?? []).forEach((variant) => {
    const variants = variantsByProduct.get(variant.product_id) ?? [];
    variants.push({
      color: variant.color,
      size: variant.size,
      stock_quantity: variant.stock_quantity,
    });
    variantsByProduct.set(variant.product_id, variants);
  });

  return {
    products: products.map((product) => ({
      ...product,
      vendor: {
        ...product.vendor,
        is_verified: vendorsById.get(product.vendor_id) ?? false,
      },
      variants: variantsByProduct.get(product.id) ?? [],
      variantsLoaded: !variantResult.error,
    })),
    vendors,
    totalCount: Number(result.totalCount ?? 0),
    options: result.options ?? { categories: [], colors: [], brands: [] },
    warning: warnings.length ? warnings.join(" ") : null,
  };
}
