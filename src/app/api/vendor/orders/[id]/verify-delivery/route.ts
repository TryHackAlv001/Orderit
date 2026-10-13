import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { code } = await request.json();
    const supabase = createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: vp } = await supabase
      .from("vendor_profiles").select("id").eq("user_id", user.id).single();

    const { data: order } = await supabase
      .from("orders")
      .select("id, delivery_code, delivery_code_used, buyer_id, payment_status, status")
      .eq("id", params.id)
      .eq("vendor_id", user.id)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.delivery_code_used) return NextResponse.json({ error: "Delivery code already used" }, { status: 400 });
    if (order.delivery_code !== code) return NextResponse.json({ error: "Invalid delivery code" }, { status: 400 });
    if (order.payment_status !== "paid" || order.status !== "out_for_delivery") {
      return NextResponse.json({ error: "Only paid orders out for delivery can be completed" }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabaseAdminClient.from("orders").update({
      status: "delivered", 
      delivery_code_used: true,
      tracking_note: "Delivery confirmed by the buyer",
    }).eq("id", params.id)
      .eq("payment_status", "paid")
      .eq("status", "out_for_delivery")
      .eq("delivery_code_used", false)
      .select("id")
      .maybeSingle();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "Order was already updated" }, { status: 409 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("verify-delivery error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
