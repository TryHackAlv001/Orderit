import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user, error: userError } = await supabase
    .from("users").select("role").eq("id", userId).single();
  if (userError || !user || !["vendor", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("return_requests")
    .select(`
      id,order_id,buyer_id,vendor_id,status,reason,note,tracking_note,photo_url,
      refund_amount,created_at,updated_at,
      return_request_items(id,order_item_id,quantity,order_item:order_items(product_name,product_image,price_at_purchase)),
      return_status_history(id,status,note,created_at)
    `)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ returns: data ?? [] });
}
