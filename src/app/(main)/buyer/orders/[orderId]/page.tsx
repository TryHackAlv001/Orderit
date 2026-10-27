import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { statusLabel, statusColor } from "@/lib/order-status";
import { ReturnRequestPanel, type ReturnRequestView } from "@/components/returns/ReturnRequestPanel";
import { ContinuePaymentButton } from "@/components/checkout/ContinuePaymentButton";
import { FLOATING_BACK_BUTTON_CONFIG } from "@/constants";

export default async function OrderDetailPage({ params }: { params: { orderId: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) return null;

  const { data: order, error } = await supabase
    .from("orders")
    .select(`id, buyer_id, vendor_id, status, subtotal, delivery_fee, total, payment_method, payment_status, delivery_address, created_at, delivered_at, dispatch_rider_name, dispatch_rider_phone, vendor:vendor_profiles(shop_name), order_items(id, product_name, quantity, price_at_purchase, product_image, selected_size)`)
    .eq("id", params.orderId)
    .eq("buyer_id", userId)
    .single();

  if (error || !order) return <div className="min-w-0 p-4 sm:p-6">Order not found.</div>;

  const [
    { data: returnWindow, error: returnPolicyError },
    { data: returnRows, error: returnError },
  ] = await Promise.all([
    supabase.from("return_policy_settings").select("return_window_days").eq("singleton", true).single(),
    supabase.from("return_requests")
      .select(`
        id,order_id,status,reason,note,photo_url,refund_amount,created_at,
        return_request_items(id,order_item_id,quantity,order_item:order_items(product_name)),
        return_status_history(id,status,note,created_at)
      `)
      .eq("order_id", order.id)
      .order("created_at", { ascending: false }),
  ]);
  if (returnPolicyError) console.error("Unable to load return policy:", returnPolicyError.message);
  if (returnError) console.error("Unable to load order returns:", returnError.message);

  const address = typeof order.delivery_address === "string"
    ? order.delivery_address
    : order.delivery_address?.address || JSON.stringify(order.delivery_address, null, 2);

  return (
    <div className="min-w-0 flex flex-col gap-6 px-0 pb-6 pt-0 md:px-4">
      <nav className="hidden text-sm md:block" aria-label="Breadcrumb">
        <Link
          href={FLOATING_BACK_BUTTON_CONFIG.parentRoutes.buyerOrderDetail}
          className="font-medium text-accent-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Orders
        </Link>
      </nav>
      <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-text">Order Details</h1>
            <p className="mt-2 break-all text-sm text-muted">Order ID: {order.id}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-muted">Order Status</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-2 text-sm font-semibold ${statusColor(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-muted">Order Date</p>
                <p className="mt-2 text-text">{new Date(order.created_at).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {order.status === "pending" &&
            order.payment_status === "pending" &&
            (order.payment_method === "pending" || order.payment_method === "paystack") && (
              <ContinuePaymentButton orderId={order.id} />
            )}

          <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
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
                  {(order.order_items || []).map((item: any) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-4 py-4 text-text">
                        {item.product_name}
                        {item.selected_size && <span className="mt-1 block text-sm text-muted">Size: {item.selected_size}</span>}
                      </td>
                      <td className="px-4 py-4 text-text">{item.quantity}</td>
                      <td className="px-4 py-4 font-display text-text">₦{Number(item.price_at_purchase).toLocaleString()}</td>
                      <td className="px-4 py-4 font-display text-text">₦{(Number(item.price_at_purchase) * item.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 space-y-2 rounded-lg border border-border bg-bg p-5 text-sm text-text">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="min-w-0">Subtotal</span>
                <span className="min-w-0 break-words text-right font-display">₦{Number(order.subtotal).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <span className="min-w-0">Delivery fee</span>
                <span className="min-w-0 break-words text-right font-display">₦{Number(order.delivery_fee).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-text">
                <span className="min-w-0 font-semibold">Total</span>
                <span className="min-w-0 break-words text-right font-display font-semibold">₦{Number(order.total).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-text">Delivery Address</h2>
            <p className="mt-4 break-words whitespace-pre-wrap text-text">{address}</p>
          </div>

          {order.dispatch_rider_name && (
            <div className="min-w-0 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
              <h3 className="text-lg font-semibold text-text">Your Delivery Rider</h3>
              <div className="mt-4 space-y-3 text-sm text-text">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Name</span>
                  <span className="min-w-0 break-words text-right">{order.dispatch_rider_name}</span>
                </div>
                {order.dispatch_rider_phone && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Phone</span>
                    <a className="text-accent-text hover:text-accent-text" href={`tel:${order.dispatch_rider_phone}`}>
                      {order.dispatch_rider_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <OrderTimeline status={order.status} orderId={order.id} />
          <ReturnRequestPanel
            orderId={order.id}
            orderStatus={order.status}
            createdAt={order.created_at}
            deliveredAt={order.delivered_at}
            returnWindowDays={returnWindow?.return_window_days ?? 0}
            policyError={returnPolicyError?.message}
            returnsError={returnError?.message}
            items={(order.order_items || []).map((item: any) => ({
              id: item.id,
              product_name: item.product_name,
              quantity: item.quantity,
              price_at_purchase: Number(item.price_at_purchase),
            }))}
            existingReturns={(returnRows ?? []) as ReturnRequestView[]}
          />
        </div>
      </div>
    </div>
  );
}