import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase-admin";

const OPEN_ORDER_STATUSES = ["pending", "confirmed", "preparing", "shipped", "out_for_delivery"];

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }

  let body: { confirmation?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid confirmation is required." }, { status: 400 });
  }
  if (body.confirmation !== "DELETE MY ACCOUNT") {
    return NextResponse.json({ error: "Type DELETE MY ACCOUNT to confirm." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to delete your account." }, { status: 401 });
  }

  const { data: openOrder, error: ordersError } = await supabaseAdminClient
    .from("orders")
    .select("id")
    .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id}`)
    .in("status", OPEN_ORDER_STATUSES)
    .limit(1)
    .maybeSingle();
  if (ordersError) {
    console.error("Account deletion order check failed:", ordersError.message);
    return NextResponse.json({ error: "Open orders could not be checked. Please retry later." }, { status: 500 });
  }
  if (openOrder) {
    return NextResponse.json({ error: "Resolve your open orders before deleting your account." }, { status: 409 });
  }

  const { data: wallet, error: walletError } = await supabaseAdminClient
    .from("wallet_accounts")
    .select("balance")
    .eq("user_id", user.id)
    .maybeSingle();
  if (walletError) {
    console.error("Account deletion wallet check failed:", walletError.message);
    return NextResponse.json({ error: "Your wallet balance could not be checked. Please retry later." }, { status: 500 });
  }
  if (Number(wallet?.balance ?? 0) !== 0) {
    return NextResponse.json({ error: "Withdraw or use your wallet balance before deleting your account." }, { status: 409 });
  }

  const { data: vendorProfile, error: vendorError } = await supabaseAdminClient
    .from("vendor_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (vendorError) {
    console.error("Account deletion vendor profile check failed:", vendorError.message);
    return NextResponse.json({ error: "Vendor data could not be checked. Please retry later." }, { status: 500 });
  }

  if (vendorProfile) {
    const { error: productsError } = await supabaseAdminClient
      .from("products")
      .update({ is_active: false })
      .eq("vendor_id", user.id);
    if (productsError) {
      console.error("Account deletion product deactivation failed:", productsError.message);
      return NextResponse.json({ error: "Vendor listings could not be deactivated. No account deletion was completed." }, { status: 500 });
    }

    const { error: vendorDeleteError } = await supabaseAdminClient
      .from("vendor_profiles")
      .delete()
      .eq("user_id", user.id);
    if (vendorDeleteError) {
      console.error("Account deletion vendor profile removal failed:", vendorDeleteError.message);
      return NextResponse.json({ error: "Vendor profile could not be removed. No account deletion was completed." }, { status: 500 });
    }
  }

  const { error: anonymizeError } = await supabaseAdminClient
    .from("users")
    .update({
      email: `deleted-${user.id}@deleted.tradeloft.invalid`,
      full_name: null,
      phone: null,
      avatar_url: null,
    })
    .eq("id", user.id);
  if (anonymizeError) {
    console.error("Account deletion profile anonymization failed:", anonymizeError.message);
    return NextResponse.json({ error: "Account details could not be anonymized. Please contact support." }, { status: 500 });
  }

  const { error: authDeleteError } = await supabaseAdminClient.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    console.error("Account deletion Auth removal failed:", authDeleteError.message);
    return NextResponse.json({
      error: "Your profile details were anonymized, but sign-in access could not be removed. Please retry or contact support.",
    }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
