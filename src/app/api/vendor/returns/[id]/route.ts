import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "pickup_scheduled"
  | "picked_up"
  | "received_by_vendor"
  | "refunded";

const nextStatuses: Record<string, ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["pickup_scheduled"],
  pickup_scheduled: ["picked_up"],
  picked_up: ["received_by_vendor"],
  received_by_vendor: ["refunded"],
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
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.status !== "string" || (body.note !== undefined && typeof body.note !== "string")) {
    return NextResponse.json({ error: "A valid return status and optional note are required." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 2000) return NextResponse.json({ error: "Tracking note must be 2000 characters or fewer." }, { status: 400 });

  const { data: returnRequest, error: requestError } = await supabase
    .from("return_requests")
    .select("id,status,vendor_id")
    .eq("id", params.id)
    .single();
  if (requestError || !returnRequest) {
    return NextResponse.json({ error: "Return request not found or access denied." }, { status: 404 });
  }
  if (user.role !== "admin" && returnRequest.vendor_id !== userId) {
    return NextResponse.json({ error: "You cannot update this return." }, { status: 403 });
  }
  if (!nextStatuses[returnRequest.status]?.includes(body.status as ReturnStatus)) {
    return NextResponse.json({ error: `Cannot move a return from ${returnRequest.status} to ${body.status}.` }, { status: 400 });
  }

  if (body.status === "refunded") {
    const { data: balance, error } = await supabase.rpc("process_return_refund", {
      p_return_request_id: returnRequest.id,
      p_note: note || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ status: "refunded", buyerWalletBalance: balance });
  }

  const { data: updated, error } = await supabase
    .from("return_requests")
    .update({ status: body.status, tracking_note: note || null })
    .eq("id", returnRequest.id)
    .select("id,status,tracking_note")
    .single();
  if (error || !updated) {
    return NextResponse.json({ error: error?.message || "Unable to update return." }, { status: 500 });
  }
  return NextResponse.json({ returnRequest: updated });
}
