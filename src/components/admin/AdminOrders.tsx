"use client";

import { useEffect, useState } from "react";
import { VendorOrderActions } from "@/components/vendor/VendorOrderActions";
import { createClient } from "@/lib/supabase/client";

interface AdminOrder {
  id: string;
  buyer_id: string;
  vendor_id: string;
  status: string;
  total: number;
  created_at: string;
  buyer_name: string;
}

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        setError("Sign in as an administrator to view orders.");
        setLoading(false);
        return;
      }
      const { data: user, error: userError } = await supabase.from("users")
        .select("role").eq("id", userId).single();
      if (userError || user?.role !== "admin") {
        setError("Administrator access is required.");
        setLoading(false);
        return;
      }

      const { data: orderRows, error: ordersError } = await supabase
        .from("orders")
        .select("id,buyer_id,vendor_id,status,total,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (ordersError) {
        setError(ordersError.message);
        setLoading(false);
        return;
      }

      const buyerIds = Array.from(new Set((orderRows ?? []).map((order) => order.buyer_id)));
      const { data: buyers, error: buyersError } = buyerIds.length
        ? await supabase.from("users").select("id,full_name").in("id", buyerIds)
        : { data: [], error: null };
      if (buyersError) {
        setError(buyersError.message);
        setLoading(false);
        return;
      }
      const buyerNames = new Map((buyers ?? []).map((buyer) => [buyer.id, buyer.full_name ?? "Buyer"]));
      setOrders((orderRows ?? []).map((order) => ({
        ...order,
        total: Number(order.total),
        buyer_name: buyerNames.get(order.buyer_id) ?? "Buyer",
      })));
      setLoading(false);
    };
    void load();
  }, []);

  if (loading) return <div className="p-8 text-center text-muted">Loading orders…</div>;
  if (error) return <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger-text">{error}</p>;

  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <p className="rounded-lg bg-surface p-8 text-center text-muted">No orders found.</p>
      ) : orders.map((order) => (
        <article key={order.id} className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="font-semibold text-text">Order {order.id.slice(0, 8)}</p>
              <p className="mt-1 text-sm text-muted">{order.buyer_name} · Vendor {order.vendor_id.slice(0, 8)}</p>
              <p className="mt-1 text-sm text-muted">₦{order.total.toLocaleString()} · {new Date(order.created_at).toLocaleString()}</p>
            </div>
            <span className="rounded-full bg-surface-raised px-3 py-1.5 text-xs font-semibold capitalize text-text">
              {order.status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <VendorOrderActions orderId={order.id} status={order.status} />
          </div>
        </article>
      ))}
    </div>
  );
}
