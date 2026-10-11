import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReturnManagement } from "@/components/returns/ReturnManagement";

export default async function AdminReturnsPage() {
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
          <h1 className="text-3xl font-semibold text-text">Return administration</h1>
          <p className="mt-2 text-sm text-muted">Review all return requests and their wallet-refund status.</p>
        </div>
        <Link href="/admin/orders" className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-text hover:bg-bg">
          Orders
        </Link>
      </div>
      <ReturnManagement />
    </div>
  );
}
