"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Search, Package, AlertTriangle, CheckCircle, XCircle, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";

interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  stock_quantity: number;
  images: string[];
  is_active: boolean;
  created_at: string;
  category?: {
    id: string;
    name: string;
  };
}

interface StockLog {
  id: string;
  previous_qty: number;
  new_qty: number;
  changed_at: string;
  user: {
    full_name?: string;
    email: string;
  };
}

interface InventoryPageProps {
  products: Product[];
  categories: { id: string; name: string }[];
}

function formatCurrency(value: number) {
  return `₦${value.toLocaleString()}`;
}

function getStockStatus(stock: number) {
  if (stock === 0) return { status: "Out of Stock", color: "bg-danger/10 text-danger-text", icon: XCircle };
  if (stock <= 5) return { status: "Low Stock", color: "bg-warning/10 text-text", icon: AlertTriangle };
  return { status: "In Stock", color: "bg-success/10 text-text", icon: CheckCircle };
}

function StockInput({
  value,
  onSave,
  onCancel
}: {
  value: number;
  onSave: (newValue: number) => void;
  onCancel: () => void;
}) {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleSave = () => {
    const numValue = parseInt(inputValue);
    if (!isNaN(numValue) && numValue >= 0) {
      onSave(numValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-20 px-2 py-1 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-ring"
        autoFocus
      />
      <button
        onClick={handleSave}
        className="p-1 text-text hover:text-text"
        title="Save"
      >
        <Save className="w-4 h-4" />
      </button>
      <button
        onClick={onCancel}
        className="p-1 text-danger-text hover:text-danger-text"
        title="Cancel"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function InventoryPage({ products: initialProducts, categories }: InventoryPageProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"all" | "low-stock">("all");
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkQuantity, setBulkQuantity] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStockHistory, setShowStockHistory] = useState<string | null>(null);
  const [stockHistory, setStockHistory] = useState<StockLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply tab filter
    if (activeTab === "low-stock") {
      filtered = filtered.filter(product => product.stock_quantity <= 5);
    }

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(product => product.category?.id === selectedCategory);
    }

    // Apply stock status filter
    if (stockFilter) {
      filtered = filtered.filter(product => {
        const status = getStockStatus(product.stock_quantity).status.toLowerCase().replace(" ", "-");
        return status === stockFilter;
      });
    }

    return filtered;
  }, [products, searchTerm, selectedCategory, stockFilter, activeTab]);

  const updateStock = async (productId: string, newQuantity: number) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/vendor/inventory/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock_quantity: newQuantity }),
      });

      if (!response.ok) {
        throw new Error("Failed to update stock");
      }

      const result = await response.json();
      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, stock_quantity: newQuantity } : p
      ));
      setEditingStock(null);
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Failed to update stock. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedProducts.size === 0 || !bulkQuantity) return;

    const quantity = parseInt(bulkQuantity);
    if (isNaN(quantity) || quantity < 0) return;

    setIsUpdating(true);
    try {
      const promises = Array.from(selectedProducts).map(productId =>
        fetch(`/api/vendor/inventory/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stock_quantity: quantity }),
        })
      );

      await Promise.all(promises);

      setProducts(prev => prev.map(p =>
        selectedProducts.has(p.id) ? { ...p, stock_quantity: quantity } : p
      ));
      setSelectedProducts(new Set());
      setBulkQuantity("");
    } catch (error) {
      console.error("Error bulk updating stock:", error);
      alert("Failed to update stock for some products. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const loadStockHistory = async (productId: string) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/vendor/products/${productId}/stock-history`);
      if (response.ok) {
        const data = await response.json();
        setStockHistory(data.logs);
      }
    } catch (error) {
      console.error("Error loading stock history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const selectAllVisible = () => {
    setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Inventory Management</h1>
          <p className="text-muted">Manage your product stock levels and track changes.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-raised rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "bg-surface text-text shadow-sm"
              : "text-muted hover:text-text"
          }`}
        >
          All Products ({products.length})
        </button>
        <button
          onClick={() => setActiveTab("low-stock")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "low-stock"
              ? "bg-surface text-text shadow-sm"
              : "text-muted hover:text-text"
          }`}
        >
          Low Stock ({products.filter(p => p.stock_quantity <= 5).length})
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by product name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Stock Status</option>
          <option value="in-stock">In Stock</option>
          <option value="low-stock">Low Stock</option>
          <option value="out-of-stock">Out of Stock</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedProducts.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-accent/10 border border-accent rounded-lg">
          <span className="text-sm font-medium text-accent-text">
            {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="New quantity"
              value={bulkQuantity}
              onChange={(e) => setBulkQuantity(e.target.value)}
              className="w-32"
              min="0"
            />
            <Button
              onClick={handleBulkUpdate}
              disabled={isUpdating || !bulkQuantity}
              className="bg-accent hover:bg-accent-hover"
            >
              {isUpdating ? <Spinner className="w-4 h-4" /> : "Update Stock"}
            </Button>
            <Button
              onClick={clearSelection}
              variant="outline"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                    onChange={(e) => e.target.checked ? selectAllVisible() : clearSelection()}
                    className="rounded border-border"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text">Product</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text">Stock</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text">Price</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text">Last Updated</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-text">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const stockStatus = getStockStatus(product.stock_quantity);
                const StatusIcon = stockStatus.icon;

                return (
                  <tr key={product.id} className="border-b border-border hover:bg-bg">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-surface-raised rounded-lg overflow-hidden flex-shrink-0">
                          {product.images[0] ? (
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-muted" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-text">{product.name}</div>
                          <div className="text-sm text-muted">ID: {product.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {product.sku || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-text">
                      {product.category?.name || "Uncategorized"}
                    </td>
                    <td className="px-4 py-3">
                      {editingStock === product.id ? (
                        <StockInput
                          value={product.stock_quantity}
                          onSave={(newValue) => updateStock(product.id, newValue)}
                          onCancel={() => setEditingStock(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingStock(product.id)}
                          className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${
                            product.stock_quantity === 0
                              ? "bg-danger/10 text-danger-text"
                              : product.stock_quantity <= 5
                              ? "bg-warning/10 text-text"
                              : "bg-success/10 text-text"
                          } hover:opacity-80 transition-opacity`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {product.stock_quantity}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-display text-sm font-medium text-text">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={stockStatus.color}>
                        {stockStatus.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {new Date(product.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setShowStockHistory(showStockHistory === product.id ? null : product.id);
                          if (showStockHistory !== product.id) {
                            loadStockHistory(product.id);
                          }
                        }}
                        className="text-accent-text hover:text-accent-text text-sm font-medium"
                      >
                        History
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text mb-2">No products found</h3>
            <p className="text-muted">
              {activeTab === "low-stock"
                ? "No products with low stock levels."
                : "Try adjusting your search or filters."}
            </p>
          </div>
        )}
      </div>

      {/* Stock History Modal */}
      {showStockHistory && (
        <div className="fixed inset-0 bg-background bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Stock History</h3>
              <button
                onClick={() => setShowStockHistory(null)}
                className="text-muted hover:text-muted"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="w-6 h-6" />
              </div>
            ) : stockHistory.length === 0 ? (
              <p className="text-muted text-center py-8">No stock changes recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {stockHistory.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-bg rounded-lg">
                    <div>
                      <div className="font-medium text-text">
                        {log.previous_qty} → {log.new_qty}
                      </div>
                      <div className="text-sm text-muted">
                        by {log.user.full_name || log.user.email}
                      </div>
                    </div>
                    <div className="text-sm text-muted">
                      {new Date(log.changed_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}