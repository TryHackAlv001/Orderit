import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorUser } from "@/lib/vendor-auth";
import { VendorProductForm } from "@/components/vendor/VendorProductForm";
import type { Category } from "@/types";

export default async function VendorProductCreatePage() {
  await requireVendorUser();
  const supabase = createSupabaseServerClient();
  const { data: categories } = await supabase
    .from<Category>("categories")
    .select("id,name")
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <VendorProductForm categories={categories ?? []} mode="new" />
      </div>
    </main>
  );
}
