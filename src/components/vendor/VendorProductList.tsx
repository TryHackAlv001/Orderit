"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
    ? "bg-accent/10 text-accent-text"
    : "bg-surface-raised text-text";
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
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products"
                  className="w-full rounded-full border border-border bg-bg py-3 pl-10 pr-4 text-sm text-text focus:border-border focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-full border border-border bg-surface py-3 px-4 text-sm text-text focus:border-border focus:outline-none focus:ring-2 focus:ring-ring"
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
                className="rounded-full border border-border bg-surface py-3 px-4 text-sm text-text focus:border-border focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/vendor/products/new" className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-on transition-colors duration-200">
              <Plus className="h-4 w-4" />
              Add Product
            </Link>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || loadingAction}
              onClick={() => updateProductStatus(selectedIds, true)}
              className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-on transition-colors duration-200 hover:brightness-95 disabled:pointer-events-none disabled:opacity-50"
            >
              Activate
            </Button>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || loadingAction}
              onClick={() => updateProductStatus(selectedIds, false)}
              variant="outline"
              className="rounded-md border-warning/50 bg-warning/10 px-5 py-3 text-sm font-semibold text-text hover:bg-warning/20 disabled:pointer-events-none disabled:opacity-50"
            >
              Deactivate
            </Button>
            <Button
              type="button"
              disabled={selectedIds.length === 0 || loadingAction}
              onClick={() => deleteProducts(selectedIds)}
              className="rounded-md bg-danger px-5 py-3 text-sm font-semibold text-accent-on transition-colors duration-200 hover:brightness-95 disabled:pointer-events-none disabled:opacity-50"
            >
              Delete
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger-text">
            {error}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm text-text">
          <thead className="bg-bg text-muted">
            <tr>
              <th className="px-4 py-4 text-left">
                <input
                  type="checkbox"
                  checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                  onChange={toggleSelectAll}
                  disabled={filteredProducts.length === 0}
                  className="h-4 w-4 rounded border-border text-text disabled:cursor-not-allowed disabled:opacity-50"
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
          <tbody className="divide-y divide-border bg-surface">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
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
                      className="h-4 w-4 rounded border-border text-text"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-lg bg-surface-raised">
                        {product.images?.[0] ? (
                          <div className="relative h-full w-full">
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              fill
                              unoptimized
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted">N/A</div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-text">{product.name}</p>
                        <p className="text-sm text-muted">{product.sku || "No SKU"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-text">{product.category?.name ?? "Uncategorized"}</td>
                  <td className="px-4 py-4 font-semibold text-text">{formatCurrency(Number(product.price))}</td>
                  <td className="px-4 py-4 text-text">{product.stock_quantity}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(product.is_active)}`}>
                      {product.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-text">{Number(product.rating).toFixed(1)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/vendor/products/${product.id}/edit`} className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-xs font-semibold text-text transition-colors duration-200 hover:bg-bg">
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteOne(product.id)}
                        className="inline-flex items-center gap-2 rounded-full bg-danger px-3 py-2 text-xs font-semibold text-accent-on transition hover:bg-danger"
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
