import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createOrderNotification } from "@/lib/order-notifications";

interface Params {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const reason = body.reason?.trim();
  if (!reason) {
    return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,buyer_id,vendor_id,status,delivery_address")
    .eq("id", params.id)
    .single();

  if (orderError || !order || order.vendor_id !== userId) {
    return NextResponse.json({ error: "Order not found or access denied" }, { status: 404 });
  }

  const deliveryAddress = typeof order.delivery_address === "object" && order.delivery_address !== null
    ? order.delivery_address
    : { address: order.delivery_address ?? "" };

  const { error } = await supabase.from("orders").update({
    status: "cancelled",
    delivery_address: { ...deliveryAddress, cancel_reason: reason },
  }).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createOrderNotification(order.buyer_id, "Order cancelled", `Your order ${order.id.slice(0, 8)} has been cancelled. Reason: ${reason}`, order.id);
  return NextResponse.json({ success: true });
}
