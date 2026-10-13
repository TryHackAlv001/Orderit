import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nextStatuses: Record<string, string[]> = {
  pending: ["confirmed"],
  confirmed: ["preparing"],
  preparing: ["shipped", "out_for_delivery"],
  shipped: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user, error: userError } = await supabase
    .from("users").select("role").eq("id", userId).single();
  if (userError || !user || !["vendor", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (typeof body.status !== "string" || (body.note !== undefined && typeof body.note !== "string")) {
    return NextResponse.json({ error: "A valid status and optional tracking note are required." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 2000) return NextResponse.json({ error: "Tracking note must be 2000 characters or fewer." }, { status: 400 });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,vendor_id,status,payment_status")
    .eq("id", params.id)
    .single();
  if (orderError || !order) return NextResponse.json({ error: "Order not found or access denied." }, { status: 404 });

  if (user.role !== "admin") {
    const { data: profile } = await supabase
      .from("vendor_profiles").select("id").eq("user_id", userId).maybeSingle();
    if (order.vendor_id !== userId && order.vendor_id !== profile?.id) {
      return NextResponse.json({ error: "You cannot update this order." }, { status: 403 });
    }
  }
  if (!nextStatuses[order.status]?.includes(body.status)) {
    return NextResponse.json({ error: `Cannot move an order from ${order.status} to ${body.status}.` }, { status: 400 });
  }
  if (order.payment_status !== "paid") {
    return NextResponse.json({ error: "An order must be paid before fulfillment." }, { status: 409 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: body.status, tracking_note: note || null })
    .eq("id", order.id)
    .select("id,status,tracking_note")
    .single();
  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message || "Unable to update order." }, { status: 500 });
  }
  return NextResponse.json({ order: updated });
}
