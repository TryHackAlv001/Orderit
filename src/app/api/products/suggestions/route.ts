import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!query) {
    const supabase = createSupabaseServerClient();
    const [{ data, error }, { data: categories, error: categoriesError }] = await Promise.all([
      supabase
        .from("products")
        .select("name")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("categories").select("name").order("name").limit(100),
    ]);

    if (error || categoriesError) {
      console.error("Search examples failed to load:", error?.message ?? categoriesError?.message);
      return NextResponse.json({ error: "Unable to load search examples." }, { status: 500 });
    }

    const seenNames = new Set<string>();
    const suggestions = (data ?? []).flatMap(({ name }) => {
      const productName = name.trim();
      const normalizedName = productName.toLowerCase();
      if (!productName || seenNames.has(normalizedName)) return [];
      seenNames.add(normalizedName);
      return [productName];
    }).slice(0, 8);
    const seenCategories = new Set<string>();
    const categoryNames = (categories ?? []).flatMap(({ name }) => {
      const categoryName = name.trim();
      const normalizedName = categoryName.toLowerCase();
      if (!categoryName || seenCategories.has(normalizedName)) return [];
      seenCategories.add(normalizedName);
      return [categoryName];
    });

    return NextResponse.json({ suggestions, categories: categoryNames });
  }

  const { data, error } = await createSupabaseServerClient().rpc("suggest_product_names", {
    p_query: query,
  });

  if (error) {
    console.error("Product name suggestions failed:", error.message);
    return NextResponse.json({ error: "Unable to load search suggestions." }, { status: 500 });
  }

  const suggestions = (data ?? []).map((row: { name: string }) => row.name);

  return NextResponse.json({ suggestions });
}
