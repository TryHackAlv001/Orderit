import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.rpc("buyer_confirm_delivery", {
    order_id: params.id,
  });
  if (error) {
    const status = error.code === "42501"
      ? 409
      : error.code === "P0002"
        ? 404
        : 500;
    console.error("Unable to confirm buyer delivery:", error.message);
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ success: true, status: "delivered" });
}
