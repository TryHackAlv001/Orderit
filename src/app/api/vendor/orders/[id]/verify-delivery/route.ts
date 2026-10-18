import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ error: "A delivery code is required." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,delivery_code,delivery_code_used,payment_status,status,vendor_id")
    .eq("id", params.id)
    .single();
  if (orderError || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.vendor_id !== user.id) return NextResponse.json({ error: "You cannot update this order." }, { status: 403 });
  if (order.delivery_code_used) return NextResponse.json({ error: "Delivery code already used" }, { status: 400 });
  if (order.delivery_code !== body.code.trim()) return NextResponse.json({ error: "Invalid delivery code" }, { status: 400 });
  if (order.payment_status !== "paid" || order.status !== "out_for_delivery") {
    return NextResponse.json({ error: "Only paid orders out for delivery can be completed" }, { status: 409 });
  }

  const { error } = await supabase.rpc("advance_order_status", {
    order_id: order.id,
    to_status: "delivered",
    details: {},
  });
  if (error) {
    const status = error.code === "42501" ? 409 : error.code === "P0002" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ success: true, status: "delivered" });
}
