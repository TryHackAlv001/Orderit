import { createSupabaseServerClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import { requireVendorUser } from "@/lib/vendor-auth";
import { VendorProductForm } from "@/components/vendor/VendorProductForm";
import type { Category, Product } from "@/types";

interface VendorProductEditPageProps {
  params: {
    id: string;
  };
}

export default async function VendorProductEditPage({ params }: VendorProductEditPageProps) {
  const user = await requireVendorUser();
  const supabase = createSupabaseServerClient();

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase
      .from<Product>("products")
      .select("*")
      .eq("id", params.id)
      .eq("vendor_id", user.id)
      .single(),
    supabase
      .from<Category>("categories")
      .select("id,name")
      .order("name", { ascending: true }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <VendorProductForm product={product} categories={categories ?? []} mode="edit" />
      </div>
    </main>
  );
}
