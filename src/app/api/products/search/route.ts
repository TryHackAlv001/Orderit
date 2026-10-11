import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Product } from "@/types";

const PAGE_SIZE = 12;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SORTS = new Set(["relevance", "price_asc", "price_desc", "rating", "newest"]);

function readPrice(value: string | null) {
  if (value === null || value === "") return { value: null, invalid: false };
  const number = Number(value);
  return { value: Number.isFinite(number) && number >= 0 ? number : null, invalid: !Number.isFinite(number) || number < 0 };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const min = readPrice(params.get("min"));
  const max = readPrice(params.get("max"));
  const minRating = readPrice(params.get("rating"));
  const rawCategories = (params.get("category") ?? "").split(",").filter(Boolean);
  const page = Number(params.get("page") ?? "1");
  const queryText = (params.get("q") ?? "").trim().slice(0, 100);
  const queryTerms = Array.from(new Set(
    queryText.match(/[\p{L}\p{N}]+/gu)?.map((term) => term.toLowerCase()) ?? [],
  )).slice(0, 10);
  const sort = params.get("sort") ?? (queryText ? "relevance" : "newest");
  const brand = (params.get("brand") ?? "").trim();
  const state = (params.get("state") ?? "").trim();
  const color = params.get("color") || null;
  const size = params.get("size") || null;
  const inStock = params.get("inStock") === "true";

  if (min.invalid || max.invalid || minRating.invalid) {
    return NextResponse.json({ error: "Price and rating filters must be valid non-negative numbers." }, { status: 400 });
  }
  if (min.value !== null && max.value !== null && min.value > max.value) {
    return NextResponse.json({ error: "Minimum price cannot be greater than maximum price." }, { status: 400 });
  }
  if (minRating.value !== null && minRating.value > 5) {
    return NextResponse.json({ error: "Rating must be between 0 and 5." }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    return NextResponse.json({ error: "Page must be a positive integer." }, { status: 400 });
  }
  if (!SORTS.has(sort)) {
    return NextResponse.json({ error: "Unsupported sort option." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  let categoryIds = rawCategories;
  if (rawCategories.length > 0) {
    const { data: categoryRows, error: categoryError } = await supabase
      .from("categories")
      .select("id,name,slug,parent_id");
    if (categoryError) return NextResponse.json({ error: "Unable to validate categories." }, { status: 500 });
    const categoryMap = new Map<string, string>((categoryRows ?? []).flatMap((category: { name: string; slug: string; id: string }) => [
      [category.name.toLowerCase(), category.id],
      [category.slug.toLowerCase(), category.id],
    ]));
    categoryIds = rawCategories.map((category) =>
      UUID_PATTERN.test(category) ? category : categoryMap.get(category.toLowerCase()) ?? ""
    );
    if (categoryIds.length !== rawCategories.length) {
      return NextResponse.json({ error: "One or more categories are invalid." }, { status: 400 });
    }
    if (categoryIds.some((category) => !category)) {
      return NextResponse.json({ error: "One or more categories are invalid." }, { status: 400 });
    }

    const childrenByParent = new Map<string, string[]>();
    (categoryRows ?? []).forEach((category: { id: string; parent_id: string | null }) => {
      if (!category.parent_id) return;
      const children = childrenByParent.get(category.parent_id) ?? [];
      children.push(category.id);
      childrenByParent.set(category.parent_id, children);
    });
    const expandedCategoryIds = new Set(categoryIds);
    const pendingCategories = [...categoryIds];
    for (let index = 0; index < pendingCategories.length; index += 1) {
      const childIds = childrenByParent.get(pendingCategories[index]) ?? [];
      childIds.forEach((childId) => {
        if (expandedCategoryIds.has(childId)) return;
        expandedCategoryIds.add(childId);
        pendingCategories.push(childId);
      });
    }
    categoryIds = [...expandedCategoryIds];
  }

  const unfilteredBrowse = !queryText
    && categoryIds.length === 0
    && min.value === null
    && max.value === null
    && !brand
    && !state
    && !color
    && !size
    && minRating.value === null
    && !inStock;

  let ids: string[];
  let totalCount: number;
  if (unfilteredBrowse) {
    let browseQuery = supabase
      .from("products")
      .select("id", { count: "exact" })
      .eq("is_active", true);
    if (sort === "price_asc") {
      browseQuery = browseQuery.order("price", { ascending: true }).order("created_at", { ascending: false });
    } else if (sort === "price_desc") {
      browseQuery = browseQuery.order("price", { ascending: false }).order("created_at", { ascending: false });
    } else if (sort === "rating") {
      browseQuery = browseQuery.order("rating", { ascending: false }).order("created_at", { ascending: false });
    } else if (sort === "relevance") {
      browseQuery = browseQuery.order("rating", { ascending: false }).order("created_at", { ascending: false });
    } else {
      browseQuery = browseQuery.order("created_at", { ascending: false });
    }
    const { data: browseRows, count, error: browseError } = await browseQuery
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (browseError) {
      console.error("Active product browse failed:", browseError.message);
      return NextResponse.json({ error: "Unable to load products." }, { status: 500 });
    }
    ids = (browseRows ?? []).map((row) => row.id);
    totalCount = count ?? 0;
  } else {
    const { data: searchRows, error: searchError } = await supabase.rpc("search_catalog_product_ids", {
      p_query: queryText || null,
      p_category_ids: categoryIds.length ? categoryIds : null,
      p_min_price: min.value,
      p_max_price: max.value,
      p_brand: brand || null,
      p_state: state || null,
      p_color: color,
      p_size: size,
      p_rating: minRating.value,
      p_in_stock: inStock,
      p_sort: sort,
      p_offset: (page - 1) * PAGE_SIZE,
      p_page_size: PAGE_SIZE,
    });

    if (searchError) {
      console.error("Catalog search failed:", searchError.message);
      return NextResponse.json({ error: "Unable to search products." }, { status: 500 });
    }

    const resultRows = (searchRows ?? []) as { product_id: string | null; total_count: number }[];
    totalCount = Number(resultRows[0]?.total_count ?? 0);
    ids = resultRows
      .map((row) => row.product_id)
      .filter((id): id is string => Boolean(id));
  }

  const [{ data: rawProducts, error: productsError }, { data: categories, error: categoriesError },
    { data: colors, error: colorsError },
    { data: brandRows, error: brandsError },
    vendorQuery] = await Promise.all([
    ids.length
      ? supabase.from("products")
          .select("*,vendor:vendor_profiles(id,shop_name,logo_url),category:categories(id,name,slug)")
          .in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("categories").select("id,name,slug").order("name"),
    supabase.from("product_color_options").select("value").order("value"),
    supabase.from("products").select("brand").eq("is_active", true).eq("is_complete", true).limit(1000),
    queryTerms.length
      ? supabase.from("vendor_profiles")
          .select("id,shop_name,shop_description,logo_url,location,is_verified")
          .or(queryTerms.flatMap((term) => [
            `shop_name.ilike.%${term}%`,
            `shop_description.ilike.%${term}%`,
            `location.ilike.%${term}%`,
          ]).join(","))
          .order("shop_name")
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const queryError = productsError || categoriesError || colorsError || brandsError || vendorQuery.error;
  if (queryError) {
    console.error("Catalog search options failed:", queryError.message);
    return NextResponse.json({ error: "Unable to load search results." }, { status: 500 });
  }

  type CatalogSearchRow = Product & {
    vendor?: { id?: string; shop_name?: string; logo_url?: string } | null;
    category?: { id: string; name: string; slug: string } | null;
  };
  const productMap = new Map<string, CatalogSearchRow>(
    ((rawProducts ?? []) as CatalogSearchRow[]).map((product) => [product.id, product])
  );
  const products = ids.flatMap((id) => {
    const product = productMap.get(id);
    if (!product) return [];
    const vendor = product.vendor;
    return [{
      ...product,
      vendor: { id: vendor?.id, full_name: vendor?.shop_name ?? "Unknown", logo_url: vendor?.logo_url },
    }];
  });

  return NextResponse.json({
    products,
    vendors: vendorQuery.data ?? [],
    totalCount,
    page,
    pageSize: PAGE_SIZE,
    options: {
      categories: categories ?? [],
      colors: (colors ?? []).map((item) => item.value),
      brands: Array.from(new Map((brandRows ?? [])
        .map((item) => item.brand?.trim().replace(/\s+/g, " "))
        .filter((brand): brand is string => Boolean(brand && brand.toLowerCase() !== "unspecified"))
        .map((brand) => [brand.toLowerCase(), brand])).values())
        .sort((a, b) => a.localeCompare(b)),
    },
  });
}
