"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMissingCatalogFields } from "@/lib/product-attributes";
import { MARKETPLACE_ROUTE } from "@/constants";

interface VendorProductRow {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  images: string[];
  brand: string;
  is_complete: boolean;
  category?: { name: string };
  variants: { color: string | null; size: string | null }[];
  missingFields: string[];
}

const statusStyles = {
  active: "bg-accent/10 text-accent-text",
  draft: "bg-surface-raised text-text",
};

export default function VendorProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<VendorProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace(MARKETPLACE_ROUTE);
        return;
      }

      const { data: userRecord, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (userError || !userRecord || userRecord.role !== "vendor") {
        router.replace(MARKETPLACE_ROUTE);
        return;
      }

      const { data, error: productsError } = await supabase
        .from("products")
        .select(`id,name,price,stock_quantity,is_active,images,category_id,brand,is_complete`)
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false });

      if (productsError) {
        setError(productsError.message);
      }

      const productList = data || [];
      const categoryIds = Array.from(new Set(productList.map((p: any) => p.category_id).filter(Boolean)));
      const productIds = productList.map((p: any) => p.id);

      const [{ data: categories }, { data: rules }, { data: variants, error: variantsError }] = await Promise.all([
        categoryIds.length
          ? supabase.from("categories").select("id,name").in("id", categoryIds)
          : Promise.resolve({ data: [] }),
        categoryIds.length
          ? supabase.from("category_attribute_rules").select("category_id,requires_color,requires_size").in("category_id", categoryIds)
          : Promise.resolve({ data: [] }),
        productIds.length
          ? supabase.from("product_variants").select("product_id,color,size").in("product_id", productIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (variantsError) setError(variantsError.message);

      const categoriesById: Record<string, any> = (categories || []).reduce((acc: any, cat: any) => {
        acc[cat.id] = cat;
        return acc;
      }, {});
      const rulesByCategory: Record<string, any> = (rules || []).reduce((acc: any, rule: any) => {
        acc[rule.category_id] = rule;
        return acc;
      }, {});
      const variantsByProduct: Record<string, { color: string | null; size: string | null }[]> = {};
      (variants || []).forEach((variant: any) => {
        variantsByProduct[variant.product_id] ??= [];
        variantsByProduct[variant.product_id].push(variant);
      });

      const productsWithCategories = productList.map((p: any) => ({
        ...p,
        category: categoriesById[p.category_id],
        variants: variantsByProduct[p.id] ?? [],
        missingFields: getMissingCatalogFields(
          p,
          rulesByCategory[p.category_id],
          variantsByProduct[p.id] ?? []
        ),
      }));

      setProducts(productsWithCategories);
      setLoading(false);
    };

    load();
  }, [router]);

  const filteredProducts = useMemo(
    () => products.filter((product) =>
      product.name.toLowerCase().includes(search.toLowerCase())
    ),
    [products, search]
  );

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this product? This will archive the item.");
    if (!confirmed) return;

    const response = await fetch(`/api/vendor/products/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();
    if (!response.ok) {
      window.alert(result.error || "Unable to delete product.");
      return;
    }

    setProducts((prev) => prev.filter((product) => product.id !== id));
  };

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center">
        <div className="animate-spin h-10 w-10 rounded-full border-4 border-t-transparent border-accent" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 px-0 py-6 md:px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text">Your Products</h1>
          <p className="mt-2 text-sm text-muted">Manage your products, pricing, stock, and publish status.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/vendor/products/new")}
          className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-on transition-colors duration-200 hover:brightness-95"
        >
          Add New Product
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products by name"
          className="w-full max-w-md rounded-full border border-border bg-surface px-4 py-3 text-sm text-text shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger-text">{error}</div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg p-12 text-center text-muted">
          <p className="text-xl font-semibold text-text">No products yet.</p>
          <p className="mt-2">Add your first product!</p>
        </div>
      ) : (
        <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-bg text-text">
              <tr>
                <th className="px-4 py-4">Image</th>
                <th className="px-4 py-4">Name</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4">Brand</th>
                <th className="px-4 py-4">Price (₦)</th>
                <th className="px-4 py-4">Stock</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-t border-border hover:bg-bg">
                  <td className="px-4 py-4 align-top">
                    <div className="relative aspect-square h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-raised">
                      {product.images?.[0] ? (
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          unoptimized
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted">No image</div>
                      )}
                    </div>
                  </td>
                  <td className="max-w-64 px-4 py-4 align-top text-text">{product.name}</td>
                  <td className="max-w-64 px-4 py-4 align-top text-muted">{product.category?.name ?? "Uncategorized"}</td>
                  <td className="px-4 py-4 align-top text-muted">{product.brand === "Unspecified" ? "Missing" : product.brand}</td>
                  <td className="px-4 py-4 align-top font-display text-text">₦{product.price.toLocaleString()}</td>
                  <td className="px-4 py-4 align-top text-text">{product.stock_quantity}</td>
                  <td className="px-4 py-4 align-top">
                    {product.missingFields.length > 0 ? (
                      <span className="inline-flex rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-text">
                        Complete missing details
                      </span>
                    ) : (
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${product.is_active ? statusStyles.active : statusStyles.draft}`}>
                        {product.is_active ? "Active" : "Draft"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top space-x-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/vendor/products/${product.id}/edit`)}
                      className="min-h-11 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-text transition hover:bg-bg"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id)}
                      className="min-h-11 rounded-full border border-danger bg-danger/10 px-3 py-2 text-xs font-semibold text-danger-text transition hover:bg-danger/10"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
