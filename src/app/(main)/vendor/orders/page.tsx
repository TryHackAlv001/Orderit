"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { statusLabel, statusColor } from "@/lib/order-status";
import { VendorOrderTrackingActions } from "@/components/vendor/VendorOrderTrackingActions";
import { ORDER_STATUS_LABELS } from "@/constants/order-status";
import { MARKETPLACE_ROUTE } from "@/constants";

interface VendorOrderRow {
  id: string;
  buyer_id: string;
  buyer_name: string;
  items_count: number;
  items: {
    product_name: string;
    product_image: string | null;
    selected_size: string | null;
    selected_color: string | null;
  }[];
  total: number;
  status: string;
  created_at: string;
}

const tabs = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: ORDER_STATUS_LABELS.preparing },
  { key: "out_for_delivery", label: ORDER_STATUS_LABELS.out_for_delivery },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const statusFilterMap: Record<string, string[] | null> = {
  all: null,
  pending: ["pending"],
  confirmed: ["confirmed"],
  preparing: ["preparing"],
  out_for_delivery: ["out_for_delivery", "shipped"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

export default function VendorOrdersPage() {
  const router = useRouter();
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const [orders, setOrders] = useState<VendorOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
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

    // Fetch vendor profile id for this user
    const { data: vp, error: vpError } = await supabase
      .from("vendor_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (vpError || !vp) {
      router.replace(MARKETPLACE_ROUTE);
      return;
    }

    const vendorId = user.id;

    const { data, error: ordersError } = await supabase
      .from("orders")
      .select("id,buyer_id,total,status,created_at,delivery_name")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    if (ordersError) {
      setError(ordersError.message);
      setLoading(false);
      return;
    }

    const orderList = data || [];
    const orderIds = orderList.map((o: any) => o.id);
    const buyerIds = Array.from(new Set(orderList.map((o: any) => o.buyer_id).filter(Boolean)));

    const { data: buyers, error: buyersError } = buyerIds.length
      ? await supabase.rpc("vendor_order_buyer_profiles", { p_buyer_ids: buyerIds })
      : { data: [], error: null };
    if (buyersError) {
      console.error("Vendor order buyer profiles failed to load:", buyersError.message);
      setError("Buyer profile details could not be loaded. Please refresh or try again later.");
    }

    const { data: items, error: itemsError } = orderIds.length
      ? await supabase
        .from("order_items")
        .select("order_id,product_id,product_name,product_image,price_at_purchase,selected_size,selected_color,product:products(name,price,images)")
        .in("order_id", orderIds)
      : { data: [] };

    if (itemsError) {
      setError(itemsError.message);
      setLoading(false);
      return;
    }

    const itemsByOrder: Record<string, VendorOrderRow["items"]> = (items || []).reduce((acc: any, item: any) => {
      acc[item.order_id] ??= [];
      acc[item.order_id].push({
        product_name: item.product_name?.trim() || item.product?.name || "Product",
        product_image: item.product_image || item.product?.images?.[0] || null,
        selected_size: item.selected_size,
        selected_color: item.selected_color,
      });
      return acc;
    }, {});

    const buyersById: Record<string, any> = (buyers || []).reduce((acc: any, b: any) => {
      acc[b.buyer_id] = b;
      return acc;
    }, {});

    setOrders(
      orderList.map((order: any) => ({
        id: order.id,
        buyer_id: order.buyer_id,
        buyer_name: order.delivery_name?.trim() || buyersById[order.buyer_id]?.full_name?.trim() || "Buyer",
        items_count: itemsByOrder[order.id]?.length || 0,
        items: itemsByOrder[order.id] || [],
        total: Number(order.total || 0),
        status: order.status,
        created_at: order.created_at,
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, [router]);

  const filteredOrders = useMemo(() => {
    const filter = statusFilterMap[activeTab];

    if (!filter) {
      return orders;
    }

    return orders.filter((order) => filter.includes(order.status));
  }, [activeTab, orders]);

  useEffect(() => {
    const tabList = tabsRef.current;
    const activeTabButton = activeTabRef.current;
    if (!tabList || !activeTabButton) return;

    const tabListBounds = tabList.getBoundingClientRect();
    const activeTabBounds = activeTabButton.getBoundingClientRect();
    const targetScrollLeft = tabList.scrollLeft
      + activeTabBounds.left
      - tabListBounds.left
      - (tabList.clientWidth - activeTabBounds.width) / 2;
    tabList.scrollTo({ left: targetScrollLeft, behavior: "smooth" });
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center">
        <div className="animate-spin h-10 w-10 rounded-full border-4 border-t-transparent border-accent" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-clip px-0 pb-6 pt-0 md:px-4 md:py-6">
      <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold text-text">Vendor Orders</h1>
          <p className="mt-2 text-sm text-muted">Review all orders and update status as they progress.</p>
        </div>
        <Link href="/vendor/returns" className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-accent px-5 py-3 text-sm font-semibold text-accent-text hover:bg-accent/10 sm:w-auto">
          Return requests
        </Link>
      </div>

      <div ref={tabsRef} className="mb-6 w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-lg bg-surface p-2 shadow-sm sm:p-4">
        <div className="flex w-max min-w-full flex-nowrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              ref={activeTab === tab.key ? activeTabRef : null}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.key
                  ? "bg-accent text-accent-on"
                  : "bg-surface-raised text-text hover:bg-surface-raised"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger-text">{error}</div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg p-12 text-center text-muted">
          <p className="text-xl font-semibold text-text">No orders here yet.</p>
          <p className="mt-2">
            {activeTab === "preparing"
              ? "Orders in the packing stage are not available in this workflow yet."
              : "No orders match this stage."}
          </p>
        </div>
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {filteredOrders.map((order) => (
            <article key={order.id} className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted">Order</p>
                  <button
                    type="button"
                    onClick={() => router.push(`/vendor/orders/${order.id}`)}
                    className="max-w-full truncate text-left font-semibold text-text underline-offset-2 hover:underline"
                  >
                    #{order.id.slice(0, 8)}
                  </button>
                </div>
                <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusColor(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <div className="mt-4 flex min-w-0 items-center gap-3">
                {order.items[0]?.product_image ? (
                  <img
                    src={order.items[0].product_image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-bg text-[10px] text-muted">
                    No photo
                  </div>
                )}
                <div className="flex min-w-0 items-center gap-1 text-sm font-medium">
                  <p className="min-w-0 truncate text-text" title={order.items[0]?.product_name || "No items"}>
                    {order.items[0]?.product_name || "No items"}
                  </p>
                  {order.items_count > 1 && (
                    <span className="shrink-0 text-muted">+{order.items_count - 1} more</span>
                  )}
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-muted">Buyer</dt>
                  <dd className="truncate text-text" title={order.buyer_name}>{order.buyer_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Total</dt>
                  <dd className="truncate font-semibold text-text">₦{order.total.toLocaleString("en-NG")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Date</dt>
                  <dd className="truncate text-text">{new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</dd>
                </div>
              </dl>
              <div className="mt-4 min-w-0 border-t border-border pt-3">
                <VendorOrderTrackingActions
                  orderId={order.id}
                  status={order.status}
                  onStatusChange={(newStatus) => setOrders((current) =>
                    current.map((item) => item.id === order.id ? { ...item, status: newStatus } : item)
                  )}
                />
              </div>
            </article>
          ))}
        </div>
        <div className="hidden w-full max-w-full min-w-0 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm md:block">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-bg text-text">
              <tr>
                <th className="px-4 py-4">Order ID</th>
                <th className="px-4 py-4">Product</th>
                <th className="px-4 py-4">Buyer</th>
                <th className="px-4 py-4">Items</th>
                <th className="px-4 py-4">Total ₦</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-t border-border hover:bg-bg">
                  <td className="px-4 py-4 text-text">{order.id.slice(0, 8)}</td>
                  <td className="min-w-64 px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {order.items[0]?.product_image ? (
                        <img src={order.items[0].product_image} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-bg text-[10px] text-muted">
                          No photo
                        </div>
                      )}
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="min-w-0 truncate text-text" title={order.items[0]?.product_name || "No items"}>
                          {order.items[0]?.product_name || "No items"}
                        </span>
                        {order.items_count > 1 && (
                          <span className="shrink-0 text-muted">+{order.items_count - 1} more</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-text">{order.buyer_name}</td>
                  <td className="px-4 py-4 text-text">
                    <span>{order.items_count}</span>
                    {order.items.some((item) => item.selected_size) && (
                      <span className="mt-1 block max-w-64 text-xs text-muted">
                        {order.items.filter((item) => item.selected_size)
                          .map((item) => `${item.product_name}: ${item.selected_size}`)
                          .join(" · ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-text">₦{order.total.toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusColor(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-muted">{new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="min-w-56 px-4 py-4">
                    <button
                      type="button"
                      onClick={() => router.push(`/vendor/orders/${order.id}`)}
                      className="mb-3 min-h-11 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-text transition hover:bg-bg"
                    >
                      View
                    </button>
                    <VendorOrderTrackingActions
                      orderId={order.id}
                      status={order.status}
                      onStatusChange={(newStatus) => setOrders((current) =>
                        current.map((item) => item.id === order.id ? { ...item, status: newStatus } : item)
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
