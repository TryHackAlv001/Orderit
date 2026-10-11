import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCatalogProductInput } from "@/lib/product-attributes";
import { getCatalogSchemaSetupError, validateCatalogAttributes } from "@/lib/catalog-validation";

async function getVendor(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return { userId: null, error: "Unauthorized" as const };

  const { data: user, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || user?.role !== "vendor") {
    return { userId: null, error: "Forbidden" as const };
  }
  return { userId, error: null };
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { userId, error: authError } = await getVendor(supabase);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError === "Unauthorized" ? 401 : 403 });
  }

  const [
    { data: categories, error: categoryError },
    { data: categoryRules, error: ruleError },
    { data: colors, error: colorError },
    { data: brandRows, error: brandError },
  ] = await Promise.all([
    supabase.from("categories").select("id,name,slug").order("name"),
    supabase.from("category_attribute_rules").select("category_id,requires_color,requires_size"),
    supabase.from("product_color_options").select("value").order("value"),
    supabase.from("products").select("brand").eq("is_active", true).eq("is_complete", true).limit(1000),
  ]);

  const queryError = categoryError || ruleError || colorError || brandError;
  if (queryError) {
    console.error("Unable to load vendor product options:", queryError.message);
    return NextResponse.json(
      { error: getCatalogSchemaSetupError(queryError) ?? "Unable to load product options." },
      { status: getCatalogSchemaSetupError(queryError) ? 503 : 500 }
    );
  }

  return NextResponse.json({
    categories: categories ?? [],
    categoryRules: categoryRules ?? [],
    colors: (colors ?? []).map((item) => item.value),
    brands: Array.from(new Map((brandRows ?? [])
      .map((item) => item.brand?.trim().replace(/\s+/g, " "))
      .filter((brand): brand is string => Boolean(brand && brand.toLowerCase() !== "unspecified"))
      .map((brand) => [brand.toLowerCase(), brand])).values())
      .sort((a, b) => a.localeCompare(b)),
  });
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { userId, error: authError } = await getVendor(supabase);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: authError === "Unauthorized" ? 401 : 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (!isCatalogProductInput(body)) {
    return NextResponse.json({
      error: "Complete all required fields: brand, category, a positive price, at least one image, and valid stock details.",
    }, { status: 400 });
  }

  const validationError = await validateCatalogAttributes(supabase, body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const { data: product, error } = await supabase.rpc("save_vendor_product_with_sizes", {
    p_product_id: null,
    p_product: { ...body, brand: body.brand.trim().replace(/\s+/g, " ") },
    p_variants: body.variants,
  });
  if (error || !product?.[0]) {
    const setupError = getCatalogSchemaSetupError(error);
    return NextResponse.json(
      { error: setupError ?? error?.message ?? "Unable to create product" },
      { status: setupError ? 503 : 400 }
    );
  }
  return NextResponse.json({ product: product[0] }, { status: 201 });
}
