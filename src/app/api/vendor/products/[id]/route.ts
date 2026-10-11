import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCatalogProductInput } from "@/lib/product-attributes";
import { getCatalogSchemaSetupError, validateCatalogAttributes } from "@/lib/catalog-validation";

interface Params {
  params: {
    id: string;
  };
}

async function authorizeVendor(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const { data: user, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !user || user.role !== "vendor") {
    return false;
  }

  return true;
}

export async function PUT(request: NextRequest, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await authorizeVendor(supabase, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    p_product_id: params.id,
    p_product: { ...body, brand: body.brand.trim().replace(/\s+/g, " ") },
    p_variants: body.variants,
  });
  if (error || !product?.[0]) {
    const setupError = getCatalogSchemaSetupError(error);
    return NextResponse.json(
      { error: setupError ?? error?.message ?? "Unable to update product" },
      { status: setupError ? 503 : 400 }
    );
  }

  return NextResponse.json({ product: product[0] });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getUser();
  const userId = sessionData.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user, error: userError } = await supabase
    .from("users").select("role").eq("id", userId).single();
  if (userError || user?.role !== "vendor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ data: product, error: productError }, { data: variants, error: variantError }] = await Promise.all([
    supabase.from("products")
    .select("id,name,description,category_id,price,compare_price,minimum_order,tags,stock_quantity,sku,is_active,images,brand,is_complete,size_type,available_sizes")
      .eq("id", params.id).eq("vendor_id", userId).maybeSingle(),
    supabase.from("product_variants")
      .select("id,color,size,stock_quantity").eq("product_id", params.id),
  ]);
  if (productError) {
    console.error("Unable to load vendor product:", productError.message);
    const setupError = getCatalogSchemaSetupError(productError);
    return NextResponse.json(
      { error: setupError ?? "Unable to load product." },
      { status: setupError ? 503 : 500 }
    );
  }
  if (!product) {
    return NextResponse.json({ error: "Product not found or access denied." }, { status: 404 });
  }
  if (variantError) {
    console.error("Unable to load vendor product variants:", variantError.message);
    const setupError = getCatalogSchemaSetupError(variantError);
    return NextResponse.json(
      { error: setupError ?? "Unable to load product variants." },
      { status: setupError ? 503 : 500 }
    );
  }
  return NextResponse.json({ product: { ...product, variants: variants ?? [] } });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await authorizeVendor(supabase, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: product, error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", params.id)
    .eq("vendor_id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product });
}
