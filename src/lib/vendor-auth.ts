import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface VendorSession {
  id: string;
  role: string;
}

export async function requireVendorUser() {
  const supabase = createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (error || !user || user.role !== "vendor") {
    redirect("/login");
  }

  return user;
}
