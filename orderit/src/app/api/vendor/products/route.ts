import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (userError || !user || user.role !== "vendor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    description,
    category_id,
    price,
    compare_price,
    stock_quantity,
    sku,
    is_active,
    images,
  } = body;

  if (!name || !category_id || !price || stock_quantity == null || !Array.isArray(images)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert([
      {
        vendor_id: userId,
        name,
        description,
        category_id,
        price,
        compare_price: compare_price ?? null,
        stock_quantity,
        sku: sku || null,
        is_active,
        images,
        rating: 0,
        review_count: 0,
      },
    ])
    .select()
    .single();

  if (error || !product) {
    return NextResponse.json({ error: error?.message || "Unable to create product" }, { status: 500 });
  }

  return NextResponse.json({ product });
}
