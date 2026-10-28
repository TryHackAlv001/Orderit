import { NextRequest, NextResponse } from "next/server";
import { initializePayment } from "@/lib/flutterwave";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase-admin";


export async function POST(request: NextRequest) {
  if (process.env.FLUTTERWAVE_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { orderId, customerName, customerPhone } = body;

    if (typeof orderId !== "string" || !orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (!user.email) {
      return NextResponse.json(
        { error: "Your account does not have an email address" },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id,buyer_id,total,status,payment_status')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (order.status !== "pending" || order.payment_status !== "pending") {
      return NextResponse.json({ error: "This order is not awaiting payment" }, { status: 409 });
    }

    const amount = Number(order.total);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Order total is invalid" }, { status: 400 });
    }

    // Generate unique transaction reference
    const txRef = `flutterwave_${orderId}_${Date.now()}`;

    // Initialize Flutterwave payment
    const flutterwaveResponse = await initializePayment(
      user.email,
      amount,
      txRef,
      {
        name: typeof customerName === "string" ? customerName : "Customer",
        phone: typeof customerPhone === "string" ? customerPhone : "",
      },
      {
        orderId,
        buyerId: user.id,
      }
    );

    if (flutterwaveResponse.status !== "success" || !flutterwaveResponse.data) {
      return NextResponse.json(
        { error: flutterwaveResponse.message || "Failed to initialize payment" },
        { status: 400 }
      );
    }

    // Update order with payment reference
    const { error: updateError } = await supabaseAdminClient.from('orders').update({
      payment_method: "flutterwave",
      payment_reference: txRef,
      payment_status: "pending",
    }).eq('id', orderId);
    if (updateError) {
      console.error("Unable to save Flutterwave payment reference:", updateError.message);
      return NextResponse.json({ error: "Unable to save payment details" }, { status: 500 });
    }

    return NextResponse.json({
      status: true,
      data: {
        link: flutterwaveResponse.data.link,
      },
    });
  } catch (error) {
    console.error("Flutterwave initialize error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
