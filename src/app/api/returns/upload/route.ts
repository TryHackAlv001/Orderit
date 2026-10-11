import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase-admin";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user, error: userError } = await supabase
    .from("users").select("role").eq("id", userId).single();
  if (userError || user?.role !== "buyer") {
    return NextResponse.json({ error: "Only buyers can upload return photos." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Photo must be JPG, PNG, or WEBP." }, { status: 400 });
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo must be smaller than 5MB." }, { status: 400 });
  }

  const path = `returns/${userId}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const { error: uploadError } = await supabaseAdminClient.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = supabaseAdminClient.storage.from("product-images").getPublicUrl(path);
  return NextResponse.json({ photoUrl: data.publicUrl });
}
