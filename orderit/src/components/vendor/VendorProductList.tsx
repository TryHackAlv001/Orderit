"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trash2, Edit3, Search, Plus, CheckCircle2, Slash } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Product, Category } from "@/types";

interface ProductRow extends Product {
  category?: {
    name: string;
  };
}

interface VendorProductListProps {
  products: ProductRow[];
  categories: Category[];
}

function formatCurrency(value: number) {
  return `₦${value.toLocaleString()}`;
}

function statusBadge(isActive: boolean) {
  return isActive
    ? "bg-emerald-100 text-emerald-800"
    : "bg-slate-100 text-slate-700";
}

export function VendorProductList({ products: initialProducts, categories }: VendorProductListProps) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter ? product.category?.name === categoryFilter : true;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? product.is_active
          : !product.is_active;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  const selectedProducts = products.filter((product) => selectedIds.includes(product.id));

  const updateProductStatus = async (ids: string[], isActive: boolean) => {
    setLoadingAction(true);
    setError(null);

    try {
      await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/vendor/products/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: isActive }),
          });

          if (!response.ok) {
            const body = await response.json();
            throw new Error(body.error || "Failed to update product");
          }
        })
      );

      setProducts((current) =>
        current.map((product) =>
          ids.includes(product.id) ? { ...product, is_active: isActive } : product
        )
      );
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update products");
    } finally {
      setLoadingAction(false);
    }
  };

  const deleteProducts = async (ids: string[]) => {
    setLoadingAction(true);
    setError(null);

    try {
      await Promise.all(
        ids.map(async (id) => {
          const response = await fetch(`/api/vendor/products/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const body = await response.json();
            throw new Error(body.error || "Failed to delete product");
          }
        })
      );

      setProducts((current) => current.filter((product) => !ids.includes(product.id)));
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete products");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteOne = async (id: string) => {
    await deleteProducts([id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((product) => product.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:w-72"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-full border border-slate-200 bg-white py-3 px-4 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-full border border-slate-200 bg-white py-3 px-4 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/vendor/products/new" className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
              <Plus className="h-4 w-4" />
              Add Product
            </Link>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || loadingAction}
              onClick={() => updateProductStatus(selectedIds, true)}
              className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-50"
            >
              Activate
            </Button>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || loadingAction}
              onClick={() => updateProductStatus(selectedIds, false)}
              className="rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:pointer-events-none disabled:opacity-50"
            >
              Deactivate
            </Button>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || loadingAction}
              onClick={() => deleteProducts(selectedIds)}
              className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-50"
            >
              Delete
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-4 text-left">
                <input
                  type="checkbox"
                  checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                  onChange={toggleSelectAll}
                  disabled={filteredProducts.length === 0}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </th>
              <th className="px-4 py-4 text-left">Product</th>
              <th className="px-4 py-4 text-left">Category</th>
              <th className="px-4 py-4 text-left">Price</th>
              <th className="px-4 py-4 text-left">Stock</th>
              <th className="px-4 py-4 text-left">Status</th>
              <th className="px-4 py-4 text-left">Rating</th>
              <th className="px-4 py-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                  No products match your filters.
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedIds, product.id]
                          : selectedIds.filter((id) => id !== product.id);
                        setSelectedIds(next);
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-3xl bg-slate-100">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">N/A</div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="text-sm text-slate-500">{product.sku || "No SKU"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{product.category?.name ?? "Uncategorized"}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">{formatCurrency(Number(product.price))}</td>
                  <td className="px-4 py-4 text-slate-700">{product.stock_quantity}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(product.is_active)}`}>
                      {product.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{Number(product.rating).toFixed(1)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/vendor/products/${product.id}/edit`} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700">
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteOne(product.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
