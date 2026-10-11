"use client";

import Link from "next/link";
import { statusLabel, statusColor } from "@/lib/order-status";

interface Order {
  id: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  vendor: {
    shop_name?: string;
    logo_url?: string;
  };
  order_items: {
    product_name: string;
    product_image?: string;
    selected_size?: string | null;
  }[];
}

export function BuyerOrdersPage({ orders }: { orders: Order[] }) {
  return (
    <div className="space-y-6 px-4 py-6">
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-text">Your Orders</h1>
            <p className="mt-2 text-sm text-muted">Review all your orders and track their progress.</p>
          </div>
          <Link href="/marketplace" className="text-sm font-semibold text-accent-text hover:text-accent-text">
            Continue Shopping
          </Link>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg p-12 text-center text-muted">
          <p className="text-xl font-semibold text-text">No orders yet</p>
          <p className="mt-2">Your completed purchases will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderRowWithCode key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      {/* Main row */}
      <div className="px-4 py-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-6 sm:items-center">
          <div>
            <p className="text-sm font-medium text-muted">Order</p>
            <p className="text-text">#{order.id.slice(0, 8)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Vendor</p>
            <p className="text-text">{order.vendor?.shop_name || "Unknown Vendor"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Items</p>
            <p className="text-text">{order.order_items?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Total</p>
            <p className="font-display text-text">₦{Number(order.total).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted">Status</p>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusColor(order.status)}`}
            >
              {statusLabel(order.status)}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-sm text-muted">
              {new Date(order.created_at).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        {order.order_items?.length > 0 && (
          <div className="space-y-1 border-t border-border px-4 py-3 text-sm sm:px-6">
            {order.order_items.map((item, index) => (
              <p key={`${item.product_name}-${index}`} className="text-text">
                {item.product_name}{item.selected_size ? ` · Size: ${item.selected_size}` : ""}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRowWithCode({ order }: { order: Order }) {
  return <OrderRow order={order} />;
}
