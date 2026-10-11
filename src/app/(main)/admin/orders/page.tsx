import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminOrders } from "@/components/admin/AdminOrders";

export default async function AdminOrdersPage() {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) redirect("/login");

  const { data: user, error } = await supabase.from("users").select("role").eq("id", userId).single();
  if (error || user?.role !== "admin") redirect("/marketplace");

  return (
    <div className="space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-text">Order administration</h1>
          <p className="mt-2 text-sm text-muted">Review orders and record status changes and tracking notes.</p>
        </div>
        <Link href="/admin/returns" className="rounded-full border border-accent px-5 py-3 text-sm font-semibold text-accent-text hover:bg-accent/10">
          Return requests
        </Link>
      </div>
      <AdminOrders />
    </div>
  );
}
