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

  const body = await request.json();
  const requestedStatus = body.status ?? "out_for_delivery";

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,buyer_id,vendor_id,status,delivery_address")
    .eq("id", params.id)
    .eq("vendor_id", vendorProfileId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found or access denied" }, { status: 404 });
  }

  if (order.status !== "confirmed" && order.status !== "preparing") {
    return NextResponse.json({ error: "Order must be confirmed or preparing to change shipping status" }, { status: 400 });
  }

  const deliveryAddress = typeof order.delivery_address === "object" && order.delivery_address !== null
    ? order.delivery_address
    : { address: order.delivery_address ?? "" };

  const updatePayload: any = { status: requestedStatus };

  const { error } = await supabase.from("orders").update(updatePayload).eq("id", params.id).eq("vendor_id", vendorProfileId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
