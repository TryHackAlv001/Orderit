import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorUser } from "@/lib/vendor-auth";
import { VendorProductList } from "@/components/vendor/VendorProductList";
import type { Category, Product } from "@/types";

export default async function VendorProductsPage() {
  const user = await requireVendorUser();
  const supabase = createSupabaseServerClient();

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from<Product>("products")
      .select("*, category:categories(name)")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from<Category>("categories")
      .select("id,name")
      .order("name", { ascending: true }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Product Management</h1>
              <p className="mt-2 text-slate-600">
                Manage your product catalog, inventory and storefront listings.
              </p>
            </div>
          </div>
        </section>

        <VendorProductList products={products ?? []} categories={categories ?? []} />
      </div>
    </main>
  );
}
