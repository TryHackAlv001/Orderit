import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BuyerOrdersPage } from "./BuyerOrdersClient";

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

async function requireBuyerUser() {
  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !user || user.role !== "buyer") {
    redirect("/marketplace");
  }

  return userId;
}

async function getOrders(userId: string): Promise<Order[]> {
  const supabase = createSupabaseServerClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(`
      id,
      total,
      status,
      payment_status,
      created_at,
      vendor:vendor_profiles(shop_name, logo_url),
      order_items(id, product_name, quantity, price_at_purchase, product_image, selected_size)
    `)
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    return [];
  }

  return (orders || []) as Order[];
}

export default async function OrdersPageWrapper() {
  const userId = await requireBuyerUser();
  const orders = await getOrders(userId);

  return <BuyerOrdersPage orders={orders} />;
}
