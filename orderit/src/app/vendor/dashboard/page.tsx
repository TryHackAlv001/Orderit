import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { Badge } from "@/components/ui/Badge";
import { VendorRevenueChart } from "@/components/dashboard/VendorRevenueChart";

interface VendorDetails {
  id: string;
  role: string;
}

interface DailyRevenuePoint {
  date: string;
  revenue: number;
}

interface VendorOrder {
  id: string;
  buyer_id: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
}

interface VendorProduct {
  id: string;
  name: string;
  stock_quantity: number;
  rating: number;
}

function formatCurrency(value: number) {
  return `₦${value.toLocaleString()}`;
}

function getStatusClass(status: string) {
  switch (status) {
    case "paid":
    case "confirmed":
    case "delivered":
      return "bg-emerald-100 text-emerald-800";
    case "pending":
      return "bg-amber-100 text-amber-800";
    case "cancelled":
    case "failed":
      return "bg-rose-100 text-rose-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-3xl bg-slate-100" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[340px] animate-pulse rounded-3xl bg-slate-100" />;
}

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-14 animate-pulse rounded-3xl bg-slate-100" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-3xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function LowStockSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-3xl bg-slate-100" />
      ))}
    </div>
  );
}

async function requireVendorUser() {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { data: user, error } = await supabase
    .from<VendorDetails>("users")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (error || !user || user.role !== "vendor") {
    redirect("/login");
  }

  return user;
}

async function VendorStatsSection({ vendorId }: { vendorId: string }) {
  const supabase = createSupabaseServerClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [productResult, monthOrderResult, orderCountResult] = await Promise.all([
    supabase
      .from<VendorProduct>("products")
      .select("id,rating,is_active")
      .eq("vendor_id", vendorId)
      .eq("is_active", true),
    supabase
      .from("orders")
      .select("total,payment_status")
      .eq("vendor_id", vendorId)
      .gte("created_at", monthStart),
    supabase
      .from("orders")
      .select("id"),
  ]);

  const products = productResult.data ?? [];
  const monthOrders = monthOrderResult.data ?? [];
  const totalOrders = orderCountResult.data?.length ?? 0;

  const totalRevenueThisMonth = monthOrders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.total), 0);

  const averageRating = products.length > 0
    ? products.reduce((sum, product) => sum + Number(product.rating), 0) / products.length
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Total Revenue (This month)</p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{formatCurrency(totalRevenueThisMonth)}</p>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Total Orders</p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{totalOrders}</p>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Active Products</p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{products.length}</p>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Average Rating</p>
        <p className="mt-4 text-3xl font-semibold text-slate-900">{averageRating.toFixed(1)}</p>
      </div>
    </div>
  );
}

async function RevenueChartSection({ vendorId }: { vendorId: string }) {
  const supabase = createSupabaseServerClient();
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 29);
  const startISO = startDate.toISOString();

  const { data: orders } = await supabase
    .from<VendorOrder>("orders")
    .select("total,created_at,payment_status")
    .eq("vendor_id", vendorId)
    .gte("created_at", startISO)
    .order("created_at", { ascending: true });

  const revenueByDay: Record<string, number> = {};
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    revenueByDay[date.toISOString().slice(0, 10)] = 0;
  }

  (orders ?? []).forEach((order) => {
    if (order.payment_status !== "paid") {
      return;
    }
    const day = new Date(order.created_at).toISOString().slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] || 0) + Number(order.total);
  });

  const chartData = Object.entries(revenueByDay).map(([date, revenue]) => ({
    date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue,
  }));

  return <VendorRevenueChart data={chartData} />;
}

async function RecentOrdersSection({ vendorId }: { vendorId: string }) {
  const supabase = createSupabaseServerClient();
  const { data: orders } = await supabase
    .from<VendorOrder>("orders")
    .select("id,buyer_id,total,status,payment_status,created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(10);

  const orderList = orders ?? [];
  const buyerIds = Array.from(new Set(orderList.map((order) => order.buyer_id))).filter(Boolean);

  const { data: buyers } = buyerIds.length > 0
    ? await supabase.from("users").select("id,full_name").in("id", buyerIds)
    : { data: [] };

  const buyerMap = new Map(buyers?.map((buyer: { id: string; full_name?: string }) => [buyer.id, buyer.full_name || "Buyer"]))
;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Recent Orders</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Last 10 orders</h2>
        </div>
        <Link href="/main/orders" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700">
          View all orders
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orderList.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No recent orders yet.
                </td>
              </tr>
            ) : (
              orderList.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-4 font-mono text-xs text-slate-800">{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-4 text-slate-700">{buyerMap.get(order.buyer_id) ?? "Buyer"}</td>
                  <td className="px-4 py-4 font-semibold text-slate-900">{formatCurrency(Number(order.total))}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(order.payment_status)}`}>
                      {order.payment_status || order.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-500">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    <Link
                      href="/main/orders"
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                    >
                      View
                    </Link>
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

async function LowStockSection({ vendorId }: { vendorId: string }) {
  const supabase = createSupabaseServerClient();
  const { data: products } = await supabase
    .from<VendorProduct>("products")
    .select("id,name,stock_quantity")
    .eq("vendor_id", vendorId)
    .lt("stock_quantity", 5)
    .order("stock_quantity", { ascending: true })
    .limit(6);

  const lowStockItems = products ?? [];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Low Stock Alert</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Products below 5 units</h2>
        </div>
      </div>

      <div className="space-y-4">
        {lowStockItems.length === 0 ? (
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-800">
            All inventory levels are healthy.
          </div>
        ) : (
          lowStockItems.map((product) => (
            <div key={product.id} className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">{product.name}</p>
                  <p className="text-sm text-slate-600">Low stock: {product.stock_quantity} left</p>
                </div>
                <Badge className="bg-amber-200 text-amber-900">Restock soon</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default async function VendorDashboardPage() {
  const user = await requireVendorUser();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-[2rem] bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Vendor Dashboard</h1>
              <p className="mt-3 max-w-2xl text-slate-600">
                Review sales, monitor inventory, and manage orders for your store.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:auto-cols-min xl:grid-flow-col">
              <Link href="/main/orders" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
                View Orders
              </Link>
              <Link href={`/main/vendor/${user.id}/store`} className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                View Store
              </Link>
            </div>
          </div>
        </div>

        <Suspense fallback={<StatsSkeleton />}>
          <VendorStatsSection vendorId={user.id} />
        </Suspense>

        <div className="grid gap-6 xl:grid-cols-[1.75fr_1fr]">
          <Suspense fallback={<ChartSkeleton />}>
            <RevenueChartSection vendorId={user.id} />
          </Suspense>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Quick Actions</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">Manage your store</h2>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Link href="/vendor/products/new" className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                  Add Product
                </Link>
                <Link href="/main/orders" className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                  View All Orders
                </Link>
                <Link href="/vendor/inventory" className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                  Manage Inventory
                </Link>
                <Link href={`/main/vendor/${user.id}/store`} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
                  View Store
                </Link>
              </div>
            </div>

            <Suspense fallback={<LowStockSkeleton />}>
              <LowStockSection vendorId={user.id} />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<OrdersSkeleton />}>
          <RecentOrdersSection vendorId={user.id} />
        </Suspense>
      </div>
    </main>
  );
}
