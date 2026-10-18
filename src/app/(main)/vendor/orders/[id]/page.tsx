"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { VendorOrderTrackingActions, type VendorOrderUpdate } from "@/components/vendor/VendorOrderTrackingActions";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { statusLabel, statusColor } from "@/lib/order-status";
import { MARKETPLACE_ROUTE } from "@/constants";

interface OrderItemRow {
  id: string;
  product_name: string;
  quantity: number;
  price_at_purchase: number;
  product_image?: string;
  selected_size?: string | null;
}

interface VendorOrderDetail {
  id: string;
  buyer_id: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  delivery_address: any;
  created_at: string;
  buyer_name: string;
  courier_name: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
  cancellation_reason: string | null;
  order_items: OrderItemRow[];
}

export default function VendorOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id;
  const [order, setOrder] = useState<VendorOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyerDetailsError, setBuyerDetailsError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId) {
        router.push("/vendor/orders");
        return;
      }

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

      // Resolve vendor profile id for this user
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

      const { data, error: orderError } = await supabase
        .from("orders")
        .select(`
          id,
          buyer_id,
          status,
          subtotal,
          delivery_fee,
          total,
          payment_method,
          payment_status,
          delivery_address,
          created_at,
          courier_name,
          rider_name,
          rider_phone,
          tracking_number,
          tracking_url,
          estimated_delivery_at,
          delivered_at,
          cancellation_reason
        `)
        .eq("id", orderId)
        .eq("vendor_id", vendorId)
        .single();

      if (orderError || !data) {
        setError("Unable to load order details.");
        setLoading(false);
        return;
      }

      // Fetch buyer details separately
      const { data: buyerProfiles, error: buyerError } = await supabase.rpc(
        "vendor_order_buyer_profiles",
        { p_buyer_ids: [data.buyer_id] },
      );
      if (buyerError) {
        console.error("Vendor order buyer profile failed to load:", buyerError.message);
        setBuyerDetailsError("Buyer profile details could not be loaded.");
      }
      const buyer = buyerProfiles?.[0];

      // Fetch order items separately
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("id,product_name,quantity,price_at_purchase,product_image,selected_size")
        .eq("order_id", orderId);

      setOrder({
        id: data.id,
        buyer_id: data.buyer_id,
        status: data.status,
        subtotal: Number(data.subtotal || 0),
        delivery_fee: Number(data.delivery_fee || 0),
        total: Number(data.total || 0),
        payment_method: data.payment_method,
        payment_status: data.payment_status,
        delivery_address: data.delivery_address,
        created_at: data.created_at,
        buyer_name: buyer?.full_name || buyer?.email || "Buyer",
        courier_name: data.courier_name,
        rider_name: data.rider_name,
        rider_phone: data.rider_phone,
        tracking_number: data.tracking_number,
        tracking_url: data.tracking_url,
        estimated_delivery_at: data.estimated_delivery_at,
        delivered_at: data.delivered_at,
        cancellation_reason: data.cancellation_reason,
        order_items: (items || []).map((item: any) => ({
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          price_at_purchase: Number(item.price_at_purchase || 0),
          product_image: item.product_image,
          selected_size: item.selected_size,
        })),
      });

      setLoading(false);
    };

    loadOrder();
  }, [orderId, router]);

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center">
        <div className="animate-spin h-10 w-10 rounded-full border-4 border-t-transparent border-accent" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-w-0 px-0 py-6 md:px-4">
        <div className="rounded-lg border border-danger bg-danger/10 p-10 text-center text-danger-text">
          <p className="text-lg font-semibold">Unable to load order details.</p>
          <p className="mt-2 text-sm">Please return to the order list and try again.</p>
          <button
            type="button"
            onClick={() => router.push("/vendor/orders")}
            className="mt-6 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-on transition-colors duration-200 hover:brightness-95"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const address = typeof order.delivery_address === "string"
    ? order.delivery_address
    : order.delivery_address?.address || JSON.stringify(order.delivery_address, null, 2);

  return (
    <div className="min-w-0 space-y-6 px-0 py-6 md:px-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text">Order Details</h1>
          <p className="mt-2 text-sm text-muted">Review the order, buyer details, and move it along the workflow.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/vendor/orders")}
          className="rounded-full border border-border bg-surface px-5 py-3 text-sm font-semibold text-text hover:bg-bg"
        >
          Back to Orders
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-6">
          <section className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-muted">Order ID</p>
                <p className="mt-2 break-all text-base text-text">{order.id}</p>
              </div>
              <span className={`inline-flex rounded-full px-3 py-2 text-sm font-semibold ${statusColor(order.status)}`}>
                {statusLabel(order.status)}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted">Buyer</p>
                <p className="mt-2 break-words text-text">{order.buyer_name}</p>
                {buyerDetailsError && <p role="alert" className="mt-1 text-xs text-danger-text">{buyerDetailsError}</p>}
              </div>
              <div>
                <p className="text-sm text-muted">Order date</p>
                <p className="mt-2 text-text">{new Date(order.created_at).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Delivery address</p>
                <p className="mt-2 break-words whitespace-pre-wrap text-text">{address}</p>
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-text">Items</h2>
            <div className="mt-4 w-full min-w-0 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-bg text-text">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.order_items.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-4 text-text">
                        {item.product_name}
                        {item.selected_size && <span className="mt-1 block text-sm text-muted">Size: {item.selected_size}</span>}
                      </td>
                      <td className="px-4 py-4 text-text">{item.quantity}</td>
                      <td className="px-4 py-4 font-display text-text">₦{item.price_at_purchase.toLocaleString()}</td>
                      <td className="px-4 py-4 font-display text-text">₦{(item.price_at_purchase * item.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 space-y-2 rounded-lg border border-border bg-bg p-5 text-sm text-text">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="min-w-0">Subtotal</span>
                <span className="min-w-0 break-words text-right font-display">₦{order.subtotal.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="min-w-0">Delivery fee</span>
                <span className="min-w-0 break-words text-right font-display">₦{order.delivery_fee.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-text">
                <span className="min-w-0 font-semibold">Total</span>
                <span className="min-w-0 break-words text-right font-display font-semibold">₦{order.total.toLocaleString()}</span>
              </div>
            </div>
          </section>

          <OrderTimeline status={order.status} orderId={order.id} />
        </div>

        <div className="space-y-6">
          <section className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-text">Order actions</h2>
            <p className="mt-2 text-sm text-muted">Update this order as you prepare and ship it.</p>
            <div className="mt-6">
              <VendorOrderTrackingActions
                orderId={order.id}
                status={order.status}
                buyerId={order.buyer_id}
                onStatusChange={(newStatus, updatedOrder) => setOrder((current) => {
                  if (!current) return current;
                  const update: VendorOrderUpdate | undefined = updatedOrder;
                  return {
                    ...current,
                    status: newStatus,
                    courier_name: update?.courier_name !== undefined ? update.courier_name : current.courier_name,
                    rider_name: update?.rider_name !== undefined ? update.rider_name : current.rider_name,
                    rider_phone: update?.rider_phone !== undefined ? update.rider_phone : current.rider_phone,
                    tracking_number: update?.tracking_number !== undefined ? update.tracking_number : current.tracking_number,
                    tracking_url: update?.tracking_url !== undefined ? update.tracking_url : current.tracking_url,
                    estimated_delivery_at: update?.estimated_delivery_at !== undefined ? update.estimated_delivery_at : current.estimated_delivery_at,
                    delivered_at: update?.delivered_at !== undefined ? update.delivered_at : current.delivered_at,
                    cancellation_reason: update?.cancellation_reason !== undefined ? update.cancellation_reason : current.cancellation_reason,
                  };
                })}
              />
            </div>
          </section>

          {(order.courier_name || order.rider_name || order.tracking_number || order.tracking_url || order.estimated_delivery_at || order.cancellation_reason) && (
            <section className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold text-text">Delivery tracking</h2>
              <dl className="mt-4 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
                {order.courier_name && (
                  <div className="min-w-0">
                    <dt className="text-muted">Courier</dt>
                    <dd className="mt-1 break-words text-text">{order.courier_name}</dd>
                  </div>
                )}
                {order.rider_name && (
                  <div className="min-w-0">
                    <dt className="text-muted">Rider</dt>
                    <dd className="mt-1 break-words text-text">{order.rider_name}</dd>
                  </div>
                )}
                {order.rider_phone && (
                  <div className="min-w-0">
                    <dt className="text-muted">Rider phone</dt>
                    <dd className="mt-1 break-words text-text">{order.rider_phone}</dd>
                  </div>
                )}
                {order.tracking_number && (
                  <div className="min-w-0">
                    <dt className="text-muted">Tracking number</dt>
                    <dd className="mt-1 break-all text-text">{order.tracking_number}</dd>
                  </div>
                )}
                {order.tracking_url && (
                  <div className="min-w-0">
                    <dt className="text-muted">Tracking link</dt>
                    <dd className="mt-1 min-w-0">
                      <a href={order.tracking_url} target="_blank" rel="noreferrer" className="break-all text-accent-text underline underline-offset-2">
                        {order.tracking_url}
                      </a>
                    </dd>
                  </div>
                )}
                {order.estimated_delivery_at && (
                  <div className="min-w-0">
                    <dt className="text-muted">Estimated delivery</dt>
                    <dd className="mt-1 break-words text-text">
                      {new Date(order.estimated_delivery_at).toLocaleString("en-NG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                )}
                {order.cancellation_reason && (
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-muted">Cancellation reason</dt>
                    <dd className="mt-1 break-words text-text">{order.cancellation_reason}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-text">Payment & delivery</h2>
            <div className="mt-4 space-y-4 text-sm text-text">
              <div className="flex justify-between">
                <span>Payment method</span>
                <span>{order.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment status</span>
                <span>{order.payment_status}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
