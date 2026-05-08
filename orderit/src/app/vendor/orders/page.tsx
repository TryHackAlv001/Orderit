import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireVendorUser } from "@/lib/vendor-auth";
import { VendorOrdersExportButton } from "@/components/vendor/VendorOrdersExportButton";
import type { Order, User } from "@/types";

const tabs = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

function badgeClass(value: string) {
  switch (value) {
    case "paid":
      return "bg-emerald-100 text-emerald-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "failed":
    case "cancelled":
      return "bg-rose-100 text-rose-800";
    case "confirmed":
      return "bg-sky-100 text-sky-800";
    case "shipped":
      return "bg-violet-100 text-violet-800";
    case "delivered":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

interface VendorOrdersPageProps {
  searchParams?: {
    status?: string;
    from?: string;
    to?: string;
    q?: string;
  };
}

export default async function VendorOrdersPage({ searchParams }: VendorOrdersPageProps) {
  const user = await requireVendorUser();
  const supabase = createSupabaseServerClient();

  const statusFilter = searchParams?.status ?? "all";
  const fromDate = searchParams?.from ? new Date(searchParams.from) : null;
  const toDate = searchParams?.to ? new Date(searchParams.to) : null;
  const queryText = searchParams?.q?.trim() ?? "";

  let query = supabase
    .from<Order>("orders")
    .select("id,buyer_id,total,status,payment_status,created_at")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (fromDate && !Number.isNaN(fromDate.getTime())) {
    query = query.gte("created_at", fromDate.toISOString());
  }

  if (toDate && !Number.isNaN(toDate.getTime())) {
    query = query.lte("created_at", toDate.toISOString());
  }

  const { data: orders = [] } = await query;
  const buyerIds = Array.from(new Set(orders.map((order) => order.buyer_id))).filter(Boolean);

  const { data: buyers = [] } = buyerIds.length
    ? await supabase.from<User>("users").select("id,full_name").in("id", buyerIds)
    : { data: [] };

  const buyerMap = new Map(buyers.map((buyer) => [buyer.id, buyer.full_name ?? "Buyer"]));
  const orderIds = orders.map((order) => order.id);

  const { data: orderItems = [] } = orderIds.length
    ? await supabase
        .from("order_items")
        .select("order_id,quantity,product_name")
        .in("order_id", orderIds)
    : { data: [] };

  const itemsByOrder = orderItems.reduce<Record<string, { count: number; summary: string }>>((acc, item) => {
    const existing = acc[item.order_id] ?? { count: 0, summary: "" };
    const count = existing.count + Number(item.quantity);
    const summary = existing.summary ? `${existing.summary}, ${item.product_name}` : item.product_name;
    acc[item.order_id] = { count, summary };
    return acc;
  }, {});

  const filteredOrders = orders.filter((order) => {
    if (!queryText) return true;
    const buyerName = buyerMap.get(order.buyer_id)?.toLowerCase() ?? "";
    const searchLower = queryText.toLowerCase();
    return order.id.includes(queryText) || buyerName.includes(searchLower);
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Order Management</h1>
              <p className="mt-2 text-slate-600">Monitor orders, update status, and keep buyers informed.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <VendorOrdersExportButton
                orders={filteredOrders.map((order) => ({
                  id: order.id,
                  buyerName: buyerMap.get(order.buyer_id) ?? "Buyer",
                  total: Number(order.total),
                  payment_status: order.payment_status,
                  status: order.status,
                  created_at: order.created_at,
                }))}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Link
                  key={tab.value}
                  href={`?status=${tab.value}&from=${searchParams?.from ?? ""}&to=${searchParams?.to ?? ""}&q=${searchParams?.q ?? ""}`}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${statusFilter === tab.value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            <form className="grid gap-4 md:grid-cols-3">
              <input
                name="q"
                defaultValue={searchParams?.q ?? ""}
                placeholder="Search order ID or buyer"
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <input
                type="date"
                name="from"
                defaultValue={searchParams?.from ?? ""}
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <input
                type="date"
                name="to"
                defaultValue={searchParams?.to ?? ""}
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <input type="hidden" name="status" value={statusFilter} />
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Apply Filters
              </button>
            </form>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-4 text-left">Order ID</th>
                <th className="px-4 py-4 text-left">Buyer</th>
                <th className="px-4 py-4 text-left">Items</th>
                <th className="px-4 py-4 text-left">Total</th>
                <th className="px-4 py-4 text-left">Payment</th>
                <th className="px-4 py-4 text-left">Status</th>
                <th className="px-4 py-4 text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                    No orders found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const buyerName = buyerMap.get(order.buyer_id) ?? "Buyer";
                  const items = itemsByOrder[order.id];
                  return (
                    <tr key={order.id} className="group hover:bg-slate-50">
                      <td className="px-4 py-4 font-mono text-xs text-slate-900">
                        <Link href={`/vendor/orders/${order.id}`} className="hover:text-slate-900 underline-offset-4 hover:underline">
                          {order.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{buyerName}</td>
                      <td className="px-4 py-4 text-slate-700">
                        {items ? `${items.count} item${items.count !== 1 ? "s" : ""}` : "No items"}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">₦{Number(order.total).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(order.payment_status)}`}>
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-500">{new Date(order.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
