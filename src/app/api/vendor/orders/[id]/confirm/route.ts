import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface Params {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve vendor profile for current user
  const { data: vp, error: vpError } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (vpError || !vp) return NextResponse.json({ error: "Vendor profile not found" }, { status: 404 });

  const vendorProfileId = userId;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,buyer_id,vendor_id,status,payment_status")
    .eq("id", params.id)
    .eq("vendor_id", vendorProfileId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found or access denied" }, { status: 404 });
  }

  console.log("confirm order:", { orderId: params.id, vendorProfileId, order });

  if (order.status !== "pending") {
    return NextResponse.json({ error: "Only pending orders can be confirmed" }, { status: 400 });
  }
  if (order.payment_status !== "paid") {
    return NextResponse.json({ error: "An order must be paid before it can be confirmed" }, { status: 409 });
  }

  // Ensure update is constrained to both id and vendor_id for safety
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: "confirmed" })
    .eq("id", params.id)
    .eq("vendor_id", vendorProfileId)
    .select("id,status")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message || "Failed to update order" }, { status: 500 });
  }

  return NextResponse.json({ success: true, status: updated.status });
}
