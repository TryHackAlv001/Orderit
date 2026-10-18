import { NextRequest, NextResponse } from "next/server";
import { getBuyerInProgressOrderStatuses } from "@/lib/buyer-orders";
import { isMissingOrderItemSelectedColorColumn } from "@/lib/order-item-color";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ORDERS_PER_PAGE = 10;

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const buyerId = authData.user?.id;
  if (!buyerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawPage = request.nextUrl.searchParams.get("page") ?? "1";
  const page = Number(rawPage);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) {
    return NextResponse.json({ error: "Page must be a positive integer." }, { status: 400 });
  }

  const [initialOrdersResult, inProgressResult] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id,
        status,
        created_at,
        order_items(id, product_name, product_image, selected_size, selected_color, variant_id, quantity, price_at_purchase)
      `)
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE - 1),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyerId)
      .in("status", [...getBuyerInProgressOrderStatuses()]),
  ]);
  let orders = (initialOrdersResult.data ?? []).map((order) => ({
    ...order,
    order_items: (order.order_items ?? []).map((item) => ({
      ...item,
      selected_color: item.selected_color ?? null,
    })),
  }));
  let ordersError = initialOrdersResult.error;

  if (ordersError && isMissingOrderItemSelectedColorColumn(ordersError)) {
    console.warn("The order_items.selected_color migration is not applied; using saved variant colors where available.");
    const legacyOrdersResult = await supabase
      .from("orders")
      .select(`
        id,
        status,
        created_at,
        order_items(id, product_name, product_image, selected_size, variant_id, quantity, price_at_purchase)
      `)
      .eq("buyer_id", buyerId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE - 1);
    orders = (legacyOrdersResult.data ?? []).map((order) => ({
      ...order,
      order_items: (order.order_items ?? []).map((item) => ({
        ...item,
        selected_color: null,
      })),
    }));
    ordersError = legacyOrdersResult.error;
  }

  if (ordersError) {
    console.error("Unable to load purchased items:", ordersError.message);
    return NextResponse.json({ error: "Purchased items could not be loaded." }, { status: 500 });
  }
  if (inProgressResult.error) {
    console.error("Unable to count in-progress buyer orders:", inProgressResult.error.message);
    return NextResponse.json({ error: "Purchase counts could not be loaded." }, { status: 500 });
  }

  const variantIds = Array.from(new Set((orders ?? [])
    .flatMap((order) => order.order_items ?? [])
    .map((item) => item.variant_id)
    .filter((variantId): variantId is string => Boolean(variantId))));
  const variantsResult = variantIds.length > 0
    ? await supabase
      .from("product_variants")
      .select("id,color")
      .in("id", variantIds)
    : { data: [], error: null };
  if (variantsResult.error) {
    console.error("Unable to load purchased item variant colors:", variantsResult.error.message);
    return NextResponse.json({ error: "Product options could not be loaded." }, { status: 500 });
  }
  const colorsByVariantId = new Map(
    (variantsResult.data ?? []).map((variant) => [variant.id, variant.color]),
  );

  const items = (orders ?? []).flatMap((order) =>
    (order.order_items ?? []).map((item) => ({
      ...item,
      selected_color: item.selected_color ?? colorsByVariantId.get(item.variant_id ?? "") ?? null,
      order_id: order.id,
      order_status: order.status,
    })),
  );

  return NextResponse.json({
    items,
    hasMore: (orders ?? []).length === ORDERS_PER_PAGE,
    inProgressOrderCount: inProgressResult.count ?? 0,
  });
}
