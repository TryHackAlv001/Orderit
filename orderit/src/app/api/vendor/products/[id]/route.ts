import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

interface Params {
  params: {
    id: string;
  };
}

async function authorizeVendor(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string) {
  const { data: user, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !user || user.role !== "vendor") {
    return false;
  }

  return true;
}

export async function PUT(request: NextRequest, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await authorizeVendor(supabase, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updatePayload: Record<string, unknown> = {};

  if (body.name !== undefined) updatePayload.name = body.name;
  if (body.description !== undefined) updatePayload.description = body.description;
  if (body.category_id !== undefined) updatePayload.category_id = body.category_id;
  if (body.price !== undefined) updatePayload.price = body.price;
  if (body.compare_price !== undefined) updatePayload.compare_price = body.compare_price;
  if (body.stock_quantity !== undefined) updatePayload.stock_quantity = body.stock_quantity;
  if (body.sku !== undefined) updatePayload.sku = body.sku;
  if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
  if (body.images !== undefined) updatePayload.images = body.images;

  const { data: product, error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", params.id)
    .eq("vendor_id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await authorizeVendor(supabase, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: product, error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", params.id)
    .eq("vendor_id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product });
}
