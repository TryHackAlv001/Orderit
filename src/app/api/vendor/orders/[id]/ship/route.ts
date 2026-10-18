import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { status?: unknown; details?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const requestedStatus = body.status ?? "out_for_delivery";
  if (requestedStatus !== "preparing" && requestedStatus !== "out_for_delivery") {
    return NextResponse.json({ error: "Use preparing or out_for_delivery as the next status." }, { status: 400 });
  }
  const details = body.details ?? {};
  if (typeof details !== "object" || details === null || Array.isArray(details)) {
    return NextResponse.json({ error: "Order status details must be an object." }, { status: 400 });
  }
  const detailValues = details as Record<string, unknown>;
  const trackingFields = new Set([
    "courier_name",
    "tracking_number",
    "tracking_url",
    "rider_name",
    "rider_phone",
    "estimated_delivery_at",
  ]);
  if (
    Object.keys(detailValues).some((key) => !trackingFields.has(key))
    || Object.values(detailValues).some((value) => typeof value !== "string")
  ) {
    return NextResponse.json({ error: "Unsupported order tracking details." }, { status: 400 });
  }
  if (requestedStatus === "preparing" && Object.keys(detailValues).length > 0) {
    return NextResponse.json({ error: "Preparing does not accept tracking details." }, { status: 400 });
  }
  if (requestedStatus === "out_for_delivery") {
    const courierName = typeof detailValues.courier_name === "string" ? detailValues.courier_name.trim() : "";
    const riderName = typeof detailValues.rider_name === "string" ? detailValues.rider_name.trim() : "";
    const riderPhone = typeof detailValues.rider_phone === "string" ? detailValues.rider_phone.trim() : "";
    const trackingNumber = typeof detailValues.tracking_number === "string" ? detailValues.tracking_number.trim() : "";
    const estimatedDate = typeof detailValues.estimated_delivery_at === "string"
      ? new Date(detailValues.estimated_delivery_at)
      : null;
    if (!courierName && !riderName) {
      return NextResponse.json({ error: "Enter a courier name or rider name." }, { status: 400 });
    }
    if (!trackingNumber) return NextResponse.json({ error: "Enter a tracking number." }, { status: 400 });
    if (riderName && !riderPhone) {
      return NextResponse.json({ error: "Enter a phone number for the rider." }, { status: 400 });
    }
    if (!estimatedDate || Number.isNaN(estimatedDate.getTime()) || estimatedDate.getTime() < Date.now()) {
      return NextResponse.json({ error: "Enter a valid estimated delivery date and time in the future." }, { status: 400 });
    }
    if (typeof detailValues.tracking_url === "string" && detailValues.tracking_url.trim()) {
      try {
        const url = new URL(detailValues.tracking_url);
        if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
      } catch {
        return NextResponse.json({ error: "The tracking link must be a valid HTTP or HTTPS URL." }, { status: 400 });
      }
    }
  }

  const { error } = await supabase.rpc("advance_order_status", {
    order_id: params.id,
    to_status: requestedStatus,
    details: detailValues,
  });
  if (error) {
    const status = error.code === "42501" ? 409 : error.code === "P0002" ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ success: true, status: requestedStatus });
}
