import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContinuePaymentButton } from "@/components/checkout/ContinuePaymentButton";

interface OrderDetail {
  id: string;
  buyer_id: string;
  vendor_id: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_reference?: string;
  payment_status: string;
  delivery_address: any;
  created_at: string;
  vendor: {
    id: string;
    full_name?: string;
    email: string;
    shop_name?: string;
  };
  orderItems: {
    id: string;
    product_id: string;
    quantity: number;
    price_at_purchase: number;
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
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !user || user.role !== "buyer") {
    redirect("/marketplace");
  }

  return userId;
}

async function getOrderDetail(orderId: string, userId: string): Promise<OrderDetail | null> {
  const supabase = createSupabaseServerClient();

  // Fetch order without relationship hints to avoid PGRST200 errors
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id,
      buyer_id,
      vendor_id,
      status,
      subtotal,
      delivery_fee,
      total,
      payment_method,
      payment_reference,
      payment_status,
      delivery_address,
      created_at
    `)
    .eq("id", orderId)
    .eq("buyer_id", userId)
    .single();

  if (error || !order) {
    console.error("Error fetching order:", error);
    return null;
  }

  // Fetch vendor details separately
  const { data: vendor } = await supabase
    .from("users")
    .select("id,full_name,email")
    .eq("id", order.vendor_id)
    .single();

  // Fetch vendor profile separately
  const { data: vendorProfile } = await supabase
    .from("vendor_profiles")
    .select("shop_name")
    .eq("user_id", order.vendor_id)
    .single();

  // Fetch order items separately
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id,product_id,quantity,price_at_purchase,product_name,product_image,selected_size")
    .eq("order_id", orderId);

  if (itemsError) {
    console.error("Error fetching order items:", itemsError);
  }

  // Transform the vendor data
  const transformedOrder = {
    ...order,
    vendor: {
      id: vendor?.id,
      full_name: vendor?.full_name,
      email: vendor?.email,
      shop_name: vendorProfile?.shop_name,
    },
    orderItems: orderItems || [],
  };

  return transformedOrder as OrderDetail;
}

export default async function OrderDetailPageWrapper({
  params,
}: {
  params: { orderId: string };
}) {
  const userId = await requireBuyerUser();
  const order = await getOrderDetail(params.orderId, userId);

  if (!order) {
    return <div className="p-6">Order not found.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-semibold text-text">Order Details</h1>
      <p className="text-muted">Order ID: {order.id}</p>
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm text-muted">Status</p>
        <p className="mt-2 font-semibold text-text">{order.status}</p>
      </div>
      {order.status === "pending" && order.payment_status === "pending" &&
        (order.payment_method === "pending" || order.payment_method === "paystack") && (
          <ContinuePaymentButton orderId={order.id} />
        )}
    </div>
  );
}