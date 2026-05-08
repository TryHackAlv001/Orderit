import { createSupabaseServerClient } from "@/lib/supabase";

export async function createOrderNotification(buyerId: string, title: string, body: string, orderId: string) {
  const supabase = createSupabaseServerClient();
  await supabase.from("notifications").insert([{ user_id: buyerId, title, body, type: "order", is_read: false, link: `/main/orders/${orderId}` }]);
}
