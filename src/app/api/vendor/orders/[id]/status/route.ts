import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { trackingNumberError, trackingUrlError } from "@/lib/tracking-validation";

const supportedStatuses = new Set([
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);
const supportedDetails = new Set([
  "courier_name",
  "tracking_number",
  "tracking_url",
  "rider_name",
  "rider_phone",
  "estimated_delivery_at",
  "tracking_note",
  "cancellation_reason",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user, error: userError } = await supabase
    .from("users").select("role").eq("id", userId).single();
  if (userError || !user || user.role !== "vendor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: unknown; details?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  if (typeof body.status !== "string" || !supportedStatuses.has(body.status)) {
    return NextResponse.json({ error: "A supported order status is required." }, { status: 400 });
  }
  if (body.details !== undefined && !isRecord(body.details)) {
    return NextResponse.json({ error: "Order status details must be an object." }, { status: 400 });
  }

  const details = isRecord(body.details) ? { ...body.details } : {};
  if (Object.keys(details).some((key) => !supportedDetails.has(key))) {
    return NextResponse.json({ error: "Unsupported order status detail." }, { status: 400 });
  }
  if (Object.values(details).some((value) => typeof value !== "string")) {
    return NextResponse.json({ error: "Order status details must be text values." }, { status: 400 });
  }

  if (typeof details.tracking_number === "string") {
    details.tracking_number = details.tracking_number.trim();
  }
  if (typeof details.tracking_note === "string") {
    details.tracking_note = details.tracking_note.trim();
  }
  for (const [key, maxLength] of [
    ["courier_name", 160],
    ["rider_name", 160],
    ["rider_phone", 40],
    ["tracking_url", 2048],
    ["cancellation_reason", 1000],
  ] as const) {
    const value = details[key];
    if (typeof value === "string" && value.length > maxLength) {
      return NextResponse.json({ error: `${key.replaceAll("_", " ")} must be ${maxLength} characters or fewer.` }, { status: 400 });
    }
  }
  if (typeof details.tracking_number === "string") {
    const trackingNumber = details.tracking_number;
    const error = trackingNumberError(trackingNumber);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }
  if (typeof details.tracking_note === "string" && details.tracking_note.length > 500) {
    return NextResponse.json({ error: "Pickup instructions must be 500 characters or fewer." }, { status: 400 });
  }
  if (typeof details.tracking_url === "string") {
    const trackingUrl = details.tracking_url.trim();
    details.tracking_url = trackingUrl;
    const error = trackingUrlError(trackingUrl);
    if (error) return NextResponse.json({ error }, { status: 400 });
  }
  const isPickupDelivery = body.status === "out_for_delivery"
    && Object.prototype.hasOwnProperty.call(details, "tracking_note");
  if (typeof details.estimated_delivery_at === "string"
    && (!isPickupDelivery || details.estimated_delivery_at.trim())) {
    const estimatedDate = new Date(details.estimated_delivery_at);
    if (Number.isNaN(estimatedDate.getTime()) || estimatedDate.getTime() < Date.now()) {
      return NextResponse.json({ error: "Enter a valid estimated delivery date and time in the future." }, { status: 400 });
    }
  }
  if (body.status === "out_for_delivery") {
    if (isPickupDelivery) {
      if (typeof details.tracking_note !== "string" || !details.tracking_note) {
        return NextResponse.json({ error: "Enter pickup address or instructions." }, { status: 400 });
      }
      if (
        ["courier_name", "tracking_number", "tracking_url", "rider_name", "rider_phone"]
          .some((key) => String(details[key] ?? "").trim())
      ) {
        return NextResponse.json({ error: "Pickup orders cannot include courier, rider, or tracking details." }, { status: 400 });
      }
    } else {
      const courierName = String(details.courier_name ?? "").trim();
      const riderName = String(details.rider_name ?? "").trim();
      if (courierName && riderName) {
        return NextResponse.json({ error: "Choose courier delivery or your own rider, not both." }, { status: 400 });
      }
      if (!courierName && !riderName) {
        return NextResponse.json({ error: "Enter a courier name or rider name." }, { status: 400 });
      }
      if (riderName && !String(details.rider_phone ?? "").trim()) {
        return NextResponse.json({ error: "Enter a phone number for the rider." }, { status: 400 });
      }
      if (courierName && String(details.rider_phone ?? "").trim()) {
        return NextResponse.json({ error: "Rider phone is only used for your own rider." }, { status: 400 });
      }
      if (riderName && (String(details.tracking_number ?? "").trim() || String(details.tracking_url ?? "").trim())) {
        return NextResponse.json({ error: "Tracking details are only used for courier delivery." }, { status: 400 });
      }
      if (!details.estimated_delivery_at) {
        return NextResponse.json({ error: "Enter an estimated delivery date and time." }, { status: 400 });
      }
    }
  } else if (body.status === "cancelled") {
    if (!String(details.cancellation_reason ?? "").trim()) {
      return NextResponse.json({ error: "Cancellation reason is required." }, { status: 400 });
    }
    if (Object.keys(details).some((key) => key !== "cancellation_reason")) {
      return NextResponse.json({ error: "Cancellation accepts only a reason." }, { status: 400 });
    }
  } else if (Object.keys(details).length > 0) {
    return NextResponse.json({ error: "This order step does not accept additional details." }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,vendor_id")
    .eq("id", params.id)
    .single();
  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found or access denied." }, { status: 404 });
  }
  if (order.vendor_id !== userId) {
    return NextResponse.json({ error: "You cannot update this order." }, { status: 403 });
  }

  const { error: transitionError } = await supabase.rpc("advance_order_status", {
    order_id: order.id,
    to_status: body.status,
    details,
  });
  if (transitionError) {
    const status = transitionError.code === "22023"
      ? 400
      : transitionError.code === "42501"
        ? 409
        : transitionError.code === "P0002"
          ? 404
          : 500;
    return NextResponse.json({ error: transitionError.message }, { status });
  }

  const { data: updated, error: updatedError } = await supabase
    .from("orders")
    .select("id,status,tracking_note,courier_name,tracking_number,tracking_url,rider_name,rider_phone,estimated_delivery_at,shipped_at,delivered_at,cancellation_reason")
    .eq("id", order.id)
    .single();
  if (updatedError || !updated) {
    return NextResponse.json({ error: updatedError?.message ?? "Order updated but could not be reloaded." }, { status: 500 });
  }
  return NextResponse.json({ order: updated });
}
