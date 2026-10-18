"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { statusLabel, statusColor } from "@/lib/order-status";
import { ORDER_STATUS_LABELS } from "@/constants/order-status";
import { PurchasedItemsList } from "@/components/order/PurchasedItemsList";

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

export function BuyerOrdersPage({
  orders,
  error,
  showInProgressOnly,
  inProgressOrderCount = 0,
  view = "orders",
}: {
  orders: Order[];
  error: boolean;
  showInProgressOnly: boolean;
  inProgressOrderCount?: number;
  view?: "orders" | "items";
}) {
  const router = useRouter();
  const displayedInProgressOrderCount = inProgressOrderCount;
  const ordersHref = showInProgressOnly ? "/buyer/orders?filter=in_progress" : "/buyer/orders";

  return (
    <div className="min-w-0 space-y-6 px-0 pb-6 pt-0 md:px-4">
      <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
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

      <nav className="grid grid-cols-2 rounded-lg border border-border bg-surface p-1" aria-label="Purchase views">
        <Link
          href={ordersHref}
          aria-current={view === "orders" ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            view === "orders" ? "bg-accent text-accent-on" : "text-muted hover:bg-surface-raised"
          }`}
        >
          Orders
        </Link>
        <Link
          href="/buyer/orders?view=items"
          aria-current={view === "items" ? "page" : undefined}
          className={`flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            view === "items" ? "bg-accent text-accent-on" : "text-muted hover:bg-surface-raised"
          }`}
        >
          Items
        </Link>
      </nav>

      {view === "items" ? (
        <PurchasedItemsList />
      ) : (
      <>
      <nav className="flex flex-wrap gap-2 border-b border-border" aria-label="Order filters">
        <Link
          href="/buyer/orders"
          aria-current={!showInProgressOnly ? "page" : undefined}
          className={`min-h-11 border-b-2 px-4 py-3 text-sm font-semibold ${
            !showInProgressOnly ? "border-accent text-text" : "border-transparent text-muted"
          }`}
        >
          All orders
        </Link>
        <Link
          href="/buyer/orders?filter=in_progress"
          aria-current={showInProgressOnly ? "page" : undefined}
          className={`min-h-11 border-b-2 px-4 py-3 text-sm font-semibold ${
            showInProgressOnly ? "border-accent text-text" : "border-transparent text-muted"
          }`}
        >
          In progress ({displayedInProgressOrderCount})
        </Link>
      </nav>
      {error ? (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-8 text-center">
          <p className="font-semibold text-danger-text">Your orders could not be loaded.</p>
          <p className="mt-2 text-sm text-muted">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg p-12 text-center text-muted">
          <p className="text-xl font-semibold text-text">
            {showInProgressOnly ? "No orders in progress" : "No orders yet"}
          </p>
          <p className="mt-2">
            {showInProgressOnly
              ? `Orders that are ${ORDER_STATUS_LABELS.pending.toLowerCase()}, ${ORDER_STATUS_LABELS.confirmed.toLowerCase()}, ${ORDER_STATUS_LABELS.preparing.toLowerCase()}, ${ORDER_STATUS_LABELS.shipped.toLowerCase()}, or ${ORDER_STATUS_LABELS.out_for_delivery.toLowerCase()} will appear here.`
              : "Your purchases will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <OrderRowWithCode key={order.id} order={order} />
          ))}
        </div>
      )}
      </>
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
            <p className="truncate text-text" title={order.vendor?.shop_name || "Unknown Vendor"}>{order.vendor?.shop_name || "Unknown Vendor"}</p>
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
              <p key={`${item.product_name}-${index}`} className="line-clamp-2 break-words text-text">
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
