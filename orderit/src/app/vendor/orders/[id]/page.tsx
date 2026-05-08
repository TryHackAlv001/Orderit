import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorUser } from "@/lib/vendor-auth";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { VendorOrderActions } from "@/components/vendor/VendorOrderActions";
import type { Order, OrderItem, User } from "@/types";

interface VendorOrderDetailPageProps {
  params: {
    id: string;
  };
}

function formatCurrency(value: number) {
  return `₦${value.toLocaleString()}`;
}

function formatAddress(address: unknown) {
  if (!address) return "No delivery address provided.";
  if (typeof address === "string") return address;
  if (typeof address === "object") {
    return Object.entries(address)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  }
  return String(address);
}

export default async function VendorOrderDetailPage({ params }: VendorOrderDetailPageProps) {
  const user = await requireVendorUser();
  const supabase = createSupabaseServerClient();

  const { data: order, error: orderError } = await supabase
    .from<Order>("orders")
    .select("*")
    .eq("id", params.id)
    .eq("vendor_id", user.id)
    .single();

  if (orderError || !order) {
    notFound();
  }

  const { data: buyer } = await supabase
    .from<User>("users")
    .select("id,full_name,phone")
    .eq("id", order.buyer_id)
    .single();

  const { data: items = [] } = await supabase
    .from<OrderItem>("order_items")
    .select("id,product_name,product_image,quantity,price_at_purchase")
    .eq("order_id", order.id);

  const buyerName = buyer?.full_name ?? "Buyer";
  const buyerPhone = buyer?.phone ?? "Not provided";
  const deliveryAddress = formatAddress(order.delivery_address);
  const timelineStatus = order.status as "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Order Details</h1>
              <p className="mt-2 text-slate-600">Review the order, update status, or message the buyer directly.</p>
            </div>
            <Link href="/vendor/orders" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
              Back to Orders
            </Link>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-500">Order ID</p>
                  <p className="mt-2 font-mono text-sm text-slate-900">{order.id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Order Date</p>
                  <p className="mt-2 text-sm text-slate-900">{new Date(order.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Buyer</p>
                  <p className="mt-2 text-sm text-slate-900">{buyerName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Buyer Phone</p>
                  <p className="mt-2 text-sm text-slate-900">{buyerPhone}</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Delivery Address</p>
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{deliveryAddress}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Items</h2>
                  <p className="text-sm text-slate-500">{items.length} item{items.length !== 1 ? "s" : ""} in this order.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Unit Price</th>
                      <th className="px-4 py-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-14 w-14 overflow-hidden rounded-3xl bg-slate-100">
                              {item.product_image ? (
                                <img src={item.product_image} alt={item.product_name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-slate-400">N/A</div>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{item.product_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{item.quantity}</td>
                        <td className="px-4 py-4 text-slate-700">{formatCurrency(Number(item.price_at_purchase))}</td>
                        <td className="px-4 py-4 font-semibold text-slate-900">{formatCurrency(Number(item.quantity) * Number(item.price_at_purchase))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Summary</h2>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                  Payment: {order.payment_status}
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Order Total</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(Number(order.total))}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Order Status</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{order.status}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <OrderTimeline status={timelineStatus} />
            <VendorOrderActions orderId={order.id} status={order.status} buyerId={order.buyer_id} />
          </div>
        </div>
      </div>
    </main>
  );
}
