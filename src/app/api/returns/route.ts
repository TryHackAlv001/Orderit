import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETURN_REASONS = new Set([
  "damaged", "not_as_described", "wrong_item", "missing_parts", "changed_mind", "other",
]);

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const buyerId = authData.user?.id;
  if (!buyerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user, error: userError } = await supabase
    .from("users").select("role").eq("id", buyerId).single();
  if (userError || user?.role !== "buyer") {
    return NextResponse.json({ error: "Only buyers can request returns." }, { status: 403 });
  }

  let body: {
    orderId?: unknown;
    itemIds?: unknown;
    reason?: unknown;
    note?: unknown;
    photoUrl?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
  if (typeof body.orderId !== "string" || !UUID_PATTERN.test(body.orderId)) {
    return NextResponse.json({ error: "A valid order is required." }, { status: 400 });
  }
  if (itemIds.length === 0 || itemIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
    return NextResponse.json({ error: "Select at least one valid order item." }, { status: 400 });
  }
  if (new Set(itemIds).size !== itemIds.length) {
    return NextResponse.json({ error: "An order item can only be selected once." }, { status: 400 });
  }
  if (typeof body.reason !== "string" || !RETURN_REASONS.has(body.reason)) {
    return NextResponse.json({ error: "Select a valid return reason." }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 2000) return NextResponse.json({ error: "Note must be 2000 characters or fewer." }, { status: 400 });

  let photoUrl: string | null = null;
  if (body.photoUrl !== undefined && body.photoUrl !== null && body.photoUrl !== "") {
    const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/returns/${buyerId}/`;
    if (typeof body.photoUrl !== "string" || !body.photoUrl.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Upload a return photo using the provided uploader." }, { status: 400 });
    }
    photoUrl = body.photoUrl;
  }

  const { data: returnId, error } = await supabase.rpc("create_return_request", {
    p_order_id: body.orderId,
    p_order_item_ids: itemIds,
    p_reason: body.reason,
    p_note: note || null,
    p_photo_url: photoUrl,
  });
  if (error || !returnId) {
    return NextResponse.json({ error: error?.message || "Unable to create return request." }, { status: 400 });
  }
  return NextResponse.json({ returnId }, { status: 201 });
}
