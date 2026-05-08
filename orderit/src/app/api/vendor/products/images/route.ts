import { NextRequest, NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const extension = file.name.split(".").pop() ?? "jpg";
  const filePath = `product-images/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabaseAdminClient.storage
    .from("product-images")
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabaseAdminClient.storage.from("product-images").getPublicUrl(filePath);
  return NextResponse.json({ url: data.publicUrl });
}
