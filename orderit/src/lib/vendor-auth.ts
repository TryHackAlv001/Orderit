import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";

export interface VendorSession {
  id: string;
  role: string;
}

export async function requireVendorUser() {
  const supabase = createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { data: user, error } = await supabase
    .from<VendorSession>("users")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (error || !user || user.role !== "vendor") {
    redirect("/login");
  }

  return user;
}
