import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/flutterwave";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase-admin";


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transaction_id");

    if (!transactionId) {
      return NextResponse.json(
        { error: "Missing transaction_id parameter" },
        { status: 400 }
      );
    }

    // Verify payment with Flutterwave
    const flutterwaveResponse = await verifyPayment(transactionId);

    if (flutterwaveResponse.status !== "success" || !flutterwaveResponse.data) {
      return NextResponse.json(
        {
          verified: false,
          message: flutterwaveResponse.message || "Payment verification failed",
        },
        { status: 400 }
      );
    }

    const txRef = flutterwaveResponse.data.tx_ref;
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { verified: false, message: "Unauthenticated" },
        { status: 401 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,buyer_id,total,payment_reference,payment_method,payment_status,status')
      .eq('payment_reference', txRef)
      .eq('buyer_id', user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }
    if (order.payment_method !== "flutterwave") {
      return NextResponse.json(
        { verified: false, message: "Payment reference does not match this order" },
        { status: 400 }
      );
    }

    const paymentStatus = flutterwaveResponse.data.status;
    const isPaid = paymentStatus === "successful" &&
      flutterwaveResponse.data.currency === "NGN" &&
      Math.round(Number(order.total) * 100) === Math.round(Number(flutterwaveResponse.data.amount) * 100);

    if (isPaid && order.payment_status !== "paid") {
      const { error: updateError } = await supabaseAdminClient.from('orders').update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        status: "confirmed",
      }).eq('id', order.id).eq('buyer_id', user.id);
      if (updateError) {
        console.error("Unable to mark Flutterwave order as paid:", updateError.message);
        return NextResponse.json(
          { verified: false, message: "Unable to update order payment status" },
          { status: 500 }
        );
      }
    }

    const { data: orderItems, error: orderItemsError } = await supabase
      .from("order_items")
      .select("product_id")
      .eq("order_id", order.id);
    if (orderItemsError) {
      console.error("Unable to load purchased Flutterwave order items:", orderItemsError.message);
      return NextResponse.json(
        { verified: false, message: "Unable to load purchased items" },
        { status: 500 }
      );
    }
    const productIds = Array.from(new Set((orderItems ?? []).map((item) => item.product_id)));
    if (isPaid && productIds.length) {
      const { error: cartError } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id)
        .in("product_id", productIds);
      if (cartError) console.error("Unable to remove purchased items from cart:", cartError.message);
    }

    return NextResponse.json({
      verified: isPaid,
      orderId: order.id,
      productIds: isPaid ? productIds : [],
      message: isPaid ? "Payment verified successfully" : "Payment failed",
      data: {
        transactionId: flutterwaveResponse.data.id,
        reference: flutterwaveResponse.data.tx_ref,
        amount: flutterwaveResponse.data.amount,
        status: flutterwaveResponse.data.status,
        createdAt: flutterwaveResponse.data.created_at,
      },
    });
  } catch (error) {
    console.error("Flutterwave verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
