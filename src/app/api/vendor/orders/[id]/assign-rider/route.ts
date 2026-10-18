import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    name?: unknown;
    phone?: unknown;
    tracking_number?: unknown;
    tracking_url?: unknown;
    estimated_delivery_at?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (
    typeof body.name !== "string"
    || !body.name.trim()
    || typeof body.phone !== "string"
    || !body.phone.trim()
    || typeof body.tracking_number !== "string"
    || !body.tracking_number.trim()
    || typeof body.estimated_delivery_at !== "string"
    || Number.isNaN(new Date(body.estimated_delivery_at).getTime())
    || new Date(body.estimated_delivery_at).getTime() < Date.now()
  ) {
    return NextResponse.json({
      error: "Rider name, phone, tracking number, and a valid estimated delivery date are required.",
    }, { status: 400 });
  }
  if (body.name.length > 160 || body.phone.length > 40 || body.tracking_number.length > 200) {
    return NextResponse.json({ error: "Rider and tracking details exceed the allowed length." }, { status: 400 });
  }
  if (body.tracking_url !== undefined && typeof body.tracking_url !== "string") {
    return NextResponse.json({ error: "Tracking link must be text." }, { status: 400 });
  }
  if (typeof body.tracking_url === "string" && body.tracking_url.length > 2048) {
    return NextResponse.json({ error: "Tracking link must be 2048 characters or fewer." }, { status: 400 });
  }
  if (typeof body.tracking_url === "string" && body.tracking_url.trim()) {
    try {
      const url = new URL(body.tracking_url);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
    } catch {
      return NextResponse.json({ error: "The tracking link must be a valid HTTP or HTTPS URL." }, { status: 400 });
    }
  }

  const { error } = await supabase.rpc("advance_order_status", {
    order_id: params.id,
    to_status: "out_for_delivery",
    details: {
      rider_name: body.name.trim(),
      rider_phone: body.phone.trim(),
      tracking_number: body.tracking_number.trim(),
      tracking_url: typeof body.tracking_url === "string" ? body.tracking_url.trim() : "",
      estimated_delivery_at: new Date(body.estimated_delivery_at).toISOString(),
    },
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
  return NextResponse.json({ success: true, status: "out_for_delivery" });
}
