import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { statusLabel, statusColor } from "@/lib/order-status";
import { ShoppingBag, CreditCard, Clock, CheckCircle } from "lucide-react";

interface BuyerStats {
  totalOrders: number;
  totalSpent: number;
  pendingOrders: number;
  deliveredOrders: number;
}

interface RecentOrder {
  id: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  vendor: {
    full_name?: string;
    email: string;
  };
  orderItems: {
    product_name: string;
    product_image?: string;
    selected_size?: string | null;
  }[];
}

async function requireBuyerUser() {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("role, full_name")
    .eq("id", userId)
    .single();

  if (error || !user) {
    redirect("/login");
  }

  if (user.role !== "buyer") {
    redirect("/vendor/dashboard");
  }

  return { userId, user };
}

async function getBuyerStats(userId: string): Promise<BuyerStats> {
  const supabase = createSupabaseServerClient();

  // Get total orders and spent
  const { data: orders, error } = await supabase
    .from("orders")
    .select("total, status")
    .eq("buyer_id", userId);

  if (error) {
    console.error("Error fetching orders:", error);
    return { totalOrders: 0, totalSpent: 0, pendingOrders: 0, deliveredOrders: 0 };
  }

  const totalOrders = orders?.length || 0;
  const totalSpent = orders?.reduce((sum, order) => sum + Number(order.total), 0) || 0;
  const pendingOrders = orders?.filter(order => ["pending", "confirmed", "shipped", "out_for_delivery"].includes(order.status)).length || 0;
  const deliveredOrders = orders?.filter(order => order.status === "delivered").length || 0;

  return { totalOrders, totalSpent, pendingOrders, deliveredOrders };
}

async function getRecentOrders(userId: string): Promise<RecentOrder[]> {
  const supabase = createSupabaseServerClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      total,
      status,
      payment_status,
      created_at,
      vendor_id
    `)
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching recent orders:", error);
    return [];
  }

  if (!orders || orders.length === 0) return [];

  // Batch fetch vendor details
  const vendorIds = [...new Set(orders.map(o => o.vendor_id))];
  const { data: vendors } = await supabase
    .from("users")
    .select("id,full_name,email")
    .in("id", vendorIds);

  const vendorsById = (vendors || []).reduce((acc: any, v: any) => {
    acc[v.id] = v;
    return acc;
  }, {});

  // Batch fetch order items
  const orderIds = orders.map(o => o.id);
  const { data: allItems } = await supabase
    .from("order_items")
    .select("order_id,product_name,product_image,selected_size")
    .in("order_id", orderIds);

  const itemsByOrderId = (allItems || []).reduce((acc: any, item: any) => {
    if (!acc[item.order_id]) acc[item.order_id] = [];
    acc[item.order_id].push(item);
    return acc;
  }, {});

  // Map vendors and items back to orders
  const enrichedOrders = orders.map((order: any) => ({
    ...order,
    vendor: vendorsById[order.vendor_id] || { full_name: "Unknown", email: "" },
    orderItems: itemsByOrderId[order.id] || [],
  }));

  return enrichedOrders || [];
}

function formatCurrency(value: number) {
  return `₦${value.toLocaleString()}`;
}

export default async function BuyerDashboard() {
  const { userId, user } = await requireBuyerUser();
  const [stats, recentOrders] = await Promise.all([
    getBuyerStats(userId),
    getRecentOrders(userId),
  ]);

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-text">
          Welcome back, {user.full_name || "Buyer"}! 👋
        </h1>
        <p className="mt-2 text-muted">
          Track your orders, manage your profile, and continue shopping.
        </p>
        <div className="mt-6">
          <Link href="/marketplace">
            <Button className="bg-accent hover:bg-accent-hover">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Continue Shopping
            </Button>
          </Link>
          <Link href="/buyer/wallet" className="ml-3 inline-flex rounded-full border border-accent px-4 py-2.5 text-sm font-semibold text-accent-text hover:bg-accent/10">
            View wallet
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Total Orders"
          value={stats.totalOrders.toString()}
          icon={<ShoppingBag className="w-5 h-5 text-accent-text" />}
        />
        <StatsCard
          title="Total Spent"
          value={formatCurrency(stats.totalSpent)}
          icon={<CreditCard className="w-5 h-5 text-text" />}
        />
        <StatsCard
          title="Pending Orders"
          value={stats.pendingOrders.toString()}
          icon={<Clock className="w-5 h-5 text-text" />}
        />
        <StatsCard
          title="Delivered Orders"
          value={stats.deliveredOrders.toString()}
          icon={<CheckCircle className="w-5 h-5 text-accent-text" />}
        />
      </div>

      {/* Recent Orders */}
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-text">Recent Orders</h2>
            <p className="mt-1 text-sm text-muted">Your latest order activity</p>
          </div>
          <Link href="/buyer/orders">
            <Button variant="outline">View All Orders</Button>
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text mb-2">No orders yet</h3>
            <p className="text-muted mb-4">Start shopping to see your orders here.</p>
            <Link href="/marketplace">
              <Button>Browse Products</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-2">
                    {order.orderItems.slice(0, 3).map((item, index) => (
                      <div
                        key={index}
                        className="w-12 h-12 bg-surface-raised rounded-lg border-2 border-border overflow-hidden flex-shrink-0"
                      >
                        {item.product_image ? (
                          <Image
                            src={item.product_image}
                            alt={item.product_name}
                            fill
                            unoptimized
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-muted" />
                          </div>
                        )}
                      </div>
                    ))}
                    {order.orderItems.length > 3 && (
                      <div className="w-12 h-12 bg-surface-raised rounded-lg border-2 border-border flex items-center justify-center text-xs font-medium text-muted">
                        +{order.orderItems.length - 3}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-text">
                      Order #{order.id.slice(0, 8)}
                    </div>
                    <div className="text-sm text-muted">
                      {order.vendor.full_name || order.vendor.email}
                    </div>
                    <div className="text-sm text-muted">
                      {new Date(order.created_at).toLocaleDateString()}
                    </div>
                    {order.orderItems.some((item) => item.selected_size) && (
                      <div className="mt-1 text-xs text-muted">
                        {order.orderItems.filter((item) => item.selected_size)
                          .map((item) => `${item.product_name}: ${item.selected_size}`)
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-text">
                    {formatCurrency(Number(order.total))}
                  </div>
                  <Badge className={statusColor(order.status)}>
                    {statusLabel(order.status)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}