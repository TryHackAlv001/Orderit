import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { reason?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "Cancellation reason is required." }, { status: 400 });
  if (reason.length > 1000) return NextResponse.json({ error: "Cancellation reason must be 1000 characters or fewer." }, { status: 400 });

  const { error } = await supabase.rpc("advance_order_status", {
    order_id: params.id,
    to_status: "cancelled",
    details: { cancellation_reason: reason },
  });
  if (error) {
    const status = error.code === "22023"
      ? 400
      : error.code === "42501"
        ? 409
        : error.code === "P0002"
          ? 404
          : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ success: true, status: "cancelled" });
}
