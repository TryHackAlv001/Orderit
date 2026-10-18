import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { OrderTracker, type TrackerHistoryEvent } from "@/components/order/OrderTracker";
import { isMissingOrderItemSelectedColorColumn } from "@/lib/order-item-color";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FLOATING_BACK_BUTTON_CONFIG } from "@/constants";
import { trackingUrlError } from "@/lib/tracking-validation";

interface TrackerItem {
  id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  selected_size: string | null;
  selected_color: string | null;
  variant_id: string | null;
  quantity: number;
  price_at_purchase: number;
}

function safeTrackingUrl(value: string | null): string | null {
  if (!value || trackingUrlError(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function BuyerOrderTrackerPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams?: { item?: string | string[] };
}) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const buyerId = authData.user?.id;
  if (!buyerId) redirect("/login");

  const initialOrderResult = await supabase
    .from("orders")
    .select(`
      id,
      buyer_id,
      vendor_id,
      status,
      cancellation_reason,
      courier_name,
      tracking_number,
      tracking_url,
      rider_name,
      rider_phone,
      estimated_delivery_at,
      tracking_note,
      order_items(id, product_id, product_name, product_image, selected_size, selected_color, variant_id, quantity, price_at_purchase)
    `)
    .eq("id", params.orderId)
    .eq("buyer_id", buyerId)
    .single();

  let order = initialOrderResult.data
    ? {
        ...initialOrderResult.data,
        order_items: initialOrderResult.data.order_items.map((item) => ({
          ...item,
          selected_color: item.selected_color ?? null,
        })),
      }
    : null;
  let orderError = initialOrderResult.error;

  if (orderError && isMissingOrderItemSelectedColorColumn(orderError)) {
    console.warn("The order_items.selected_color migration is not applied; using saved variant colors where available.");
    const legacyOrderResult = await supabase
      .from("orders")
      .select(`
        id,
        buyer_id,
        vendor_id,
        status,
        cancellation_reason,
        courier_name,
        tracking_number,
        tracking_url,
        rider_name,
        rider_phone,
        estimated_delivery_at,
        tracking_note,
        order_items(id, product_id, product_name, product_image, selected_size, variant_id, quantity, price_at_purchase)
      `)
      .eq("id", params.orderId)
      .eq("buyer_id", buyerId)
      .single();
    order = legacyOrderResult.data
      ? {
          ...legacyOrderResult.data,
          order_items: legacyOrderResult.data.order_items.map((item) => ({
            ...item,
            selected_color: null,
          })),
        }
      : null;
    orderError = legacyOrderResult.error;
  }

  if (orderError) {
    console.error("Unable to load buyer order tracker:", orderError.message);
    throw new Error("Unable to load this order tracker.");
  }
  if (!order) {
    notFound();
  }

  const trackerOrder = order;
  const requestedItemId = typeof searchParams?.item === "string" ? searchParams.item : undefined;
  const item = requestedItemId
    ? trackerOrder.order_items.find((orderItem) => orderItem.id === requestedItemId)
    : trackerOrder.order_items[0];
  if (!item) notFound();

  const [historyResult, variantResult] = await Promise.all([
    supabase
      .from("order_status_history")
      .select("id,to_status,note,created_at")
      .eq("order_id", trackerOrder.id)
      .order("created_at", { ascending: true }),
    item.variant_id && !item.selected_color
      ? supabase.from("product_variants").select("id,color").eq("id", item.variant_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (historyResult.error) {
    console.error("Unable to load order tracking history:", historyResult.error.message);
  }
  if (variantResult.error) {
    console.error("Unable to load selected item color:", variantResult.error.message);
  }

  const history: TrackerHistoryEvent[] = (historyResult.data ?? []).map((event) => ({
    id: event.id,
    status: event.to_status,
    note: event.note,
    created_at: event.created_at,
  }));

  return (
    <div className="w-full min-w-0">
      <nav className="mx-auto mb-4 hidden w-full max-w-3xl text-sm md:block" aria-label="Breadcrumb">
        <Link
          href={`${FLOATING_BACK_BUTTON_CONFIG.parentRoutes.buyerOrderDetail}/${trackerOrder.id}`}
          className="font-medium text-accent-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Order #{trackerOrder.id.slice(0, 8)}
        </Link>
      </nav>
      <OrderTracker
        order={{
          id: trackerOrder.id,
          status: trackerOrder.status,
          cancellation_reason: trackerOrder.cancellation_reason,
          courier_name: trackerOrder.courier_name,
          tracking_number: trackerOrder.tracking_number,
          tracking_url: safeTrackingUrl(trackerOrder.tracking_url),
          rider_name: trackerOrder.rider_name,
          rider_phone: trackerOrder.rider_phone,
          estimated_delivery_at: trackerOrder.estimated_delivery_at,
          tracking_note: trackerOrder.tracking_note,
          vendor_id: trackerOrder.vendor_id,
        }}
        item={{
          ...item,
          selected_color: item.selected_color ?? variantResult.data?.color ?? null,
        }}
        history={history}
      />
    </div>
  );
}
