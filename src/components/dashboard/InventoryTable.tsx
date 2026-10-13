import Link from "next/link";
import { Package, AlertTriangle, TrendingUp } from "lucide-react";

export function InventoryTable() {
  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Inventory Overview</h3>
          <p className="mt-2 text-sm text-muted">Quick view of your stock levels.</p>
        </div>
        <Link
          href="/vendor/inventory"
          className="text-accent-text text-sm font-medium transition-colors duration-200 hover:underline"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 p-4 bg-success/10 rounded-lg">
          <div className="p-2 bg-success/10 rounded-lg">
            <Package className="w-5 h-5 text-text" />
          </div>
          <div>
            <div className="text-sm font-medium text-text">In Stock</div>
            <div className="text-lg font-semibold text-text">24</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-warning/10 rounded-lg">
          <div className="p-2 bg-warning/10 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-text" />
          </div>
          <div>
            <div className="text-sm font-medium text-text">Low Stock</div>
            <div className="text-lg font-semibold text-text">3</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-danger/10 rounded-lg">
          <div className="p-2 bg-danger/10 rounded-lg">
            <TrendingUp className="w-5 h-5 text-danger-text" />
          </div>
          <div>
            <div className="text-sm font-medium text-danger-text">Out of Stock</div>
            <div className="text-lg font-semibold text-danger-text">1</div>
          </div>
        </div>
      </div>
    </section>
  );
}
