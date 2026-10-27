import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBuyerInProgressOrderStatuses } from "@/lib/buyer-orders";
import { BuyerOrdersPage } from "./BuyerOrdersClient";

export type BuyerOrdersFilter = "all" | "in_progress" | "delivered" | "cancelled";

interface Order {
  id: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
  order_items: {
    id: string;
    product_name: string;
    product_image: string | null;
    selected_size?: string | null;
    selected_color?: string | null;
    quantity: number;
    price_at_purchase: number;
  }[];
}

export type BuyerPurchasedItem = Order["order_items"][number] & {
  order_id: string;
  order_total: number;
  order_status: string;
  payment_status: string;
  order_created_at: string;
};

async function requireAuthenticatedUser() {
  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  return userId;
}

async function getOrders(userId: string, filter: BuyerOrdersFilter) {
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("orders")
    .select(`
      id,
      total,
      status,
      payment_status,
      created_at,
      order_items(id, product_name, quantity, price_at_purchase, product_image, selected_size, selected_color)
    `)
    .eq("buyer_id", userId);
  if (filter === "in_progress") {
    query = query.in("status", [...getBuyerInProgressOrderStatuses()]);
  } else if (filter === "delivered" || filter === "cancelled") {
    query = query.eq("status", filter);
  }
  const [ordersResult, inProgressCountResult] = await Promise.all([
    query.order("created_at", { ascending: false }).order("id", { ascending: false }),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", userId)
      .in("status", [...getBuyerInProgressOrderStatuses()]),
  ]);

  if (ordersResult.error || inProgressCountResult.error) {
    if (ordersResult.error) console.error("Error fetching orders:", ordersResult.error);
    if (inProgressCountResult.error) console.error("Error counting in-progress orders:", inProgressCountResult.error);
    return { items: [] as BuyerPurchasedItem[], inProgressOrderCount: 0, error: true };
  }

  return {
    items: ((ordersResult.data ?? []) as Order[]).flatMap((order) =>
      order.order_items.map((item) => ({
        ...item,
        order_id: order.id,
        order_total: order.total,
        order_status: order.status,
        payment_status: order.payment_status,
        order_created_at: order.created_at,
      })),
    ),
    inProgressOrderCount: inProgressCountResult.count ?? 0,
    error: false,
  };
}

export default async function OrdersPageWrapper({
  filter,
}: {
  filter: BuyerOrdersFilter;
}) {
  const userId = await requireAuthenticatedUser();
  const result = await getOrders(userId, filter);

  return (
    <BuyerOrdersPage
      items={result.items}
      error={result.error}
      filter={filter}
      inProgressOrderCount={result.inProgressOrderCount}
    />
  );
}
