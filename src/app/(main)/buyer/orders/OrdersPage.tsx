import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBuyerInProgressOrderStatuses } from "@/lib/buyer-orders";
import { BuyerOrdersPage } from "./BuyerOrdersClient";

interface Order {
  id: string;
  vendor_id: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  vendor: { shop_name?: string; logo_url?: string };
  order_items: {
    product_name: string;
    product_image?: string;
    selected_size?: string | null;
  }[];
}

async function requireAuthenticatedUser() {
  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  return userId;
}

async function getOrders(userId: string, showInProgressOnly: boolean) {
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("orders")
    .select(`
      id,
      vendor_id,
      total,
      status,
      payment_status,
      created_at,
      order_items(id, product_name, quantity, price_at_purchase, product_image, selected_size)
    `)
    .eq("buyer_id", userId);
  if (showInProgressOnly) {
    query = query.in("status", [...getBuyerInProgressOrderStatuses()]);
  }
  const [ordersResult, inProgressCountResult] = await Promise.all([
    query.order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", userId)
      .in("status", [...getBuyerInProgressOrderStatuses()]),
  ]);

  if (ordersResult.error || inProgressCountResult.error) {
    if (ordersResult.error) console.error("Error fetching orders:", ordersResult.error);
    if (inProgressCountResult.error) console.error("Error counting in-progress orders:", inProgressCountResult.error);
    return { orders: [] as Order[], inProgressOrderCount: 0, error: true };
  }

  const orderRows = (ordersResult.data ?? []) as Omit<Order, "vendor">[];
  const vendorIds = Array.from(new Set(orderRows.map((order) => order.vendor_id)));
  const vendorProfilesResult = vendorIds.length > 0
    ? await supabase
      .from("vendor_profiles")
      .select("user_id, shop_name, logo_url")
      .in("user_id", vendorIds)
    : { data: [], error: null };

  if (vendorProfilesResult.error) {
    console.error("Error fetching order vendor profiles:", vendorProfilesResult.error);
    return { orders: [] as Order[], inProgressOrderCount: 0, error: true };
  }

  const vendorProfiles = new Map(
    (vendorProfilesResult.data ?? []).map((profile) => [profile.user_id, profile]),
  );

  return {
    orders: orderRows.map((order) => ({
      ...order,
      vendor: vendorProfiles.get(order.vendor_id) ?? {},
    })),
    inProgressOrderCount: inProgressCountResult.count ?? 0,
    error: false,
  };
}

export default async function OrdersPageWrapper({
  showInProgressOnly,
  view,
}: {
  showInProgressOnly: boolean;
  view: "orders" | "items";
}) {
  const userId = await requireAuthenticatedUser();

  if (view === "items") {
    return <BuyerOrdersPage orders={[]} error={false} showInProgressOnly={showInProgressOnly} view={view} />;
  }

  const result = await getOrders(userId, showInProgressOnly);

  return (
    <BuyerOrdersPage
      orders={result.orders}
      error={result.error}
      showInProgressOnly={showInProgressOnly}
      inProgressOrderCount={result.inProgressOrderCount}
      view={view}
    />
  );
}
