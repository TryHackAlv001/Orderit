import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function BuyerWalletPage() {
  const supabase = createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) redirect("/login");

  const { data: user, error: userError } = await supabase.from("users").select("role").eq("id", userId).single();
  if (userError || user?.role !== "buyer") redirect("/marketplace");

  const [{ data: account, error: accountError }, { data: transactions, error: transactionsError }] = await Promise.all([
    supabase.from("wallet_accounts").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.from("wallet_transactions").select("id,amount,description,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  const error = accountError || transactionsError;
  if (error) {
    return <p role="alert" className="m-4 rounded-lg bg-danger/10 p-4 text-sm text-danger-text">Unable to load wallet: {error.message}</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6 px-0 py-6 md:px-4">
      <div>
        <h1 className="text-3xl font-semibold text-text">Wallet</h1>
        <p className="mt-2 text-sm text-muted">Refunds from approved returns are credited here.</p>
      </div>
      <section className="rounded-lg border border-border bg-surface-raised p-7">
        <p className="text-sm text-muted">Available balance</p>
        <p className="mt-2 font-display text-4xl font-semibold text-text">₦{Number(account?.balance ?? 0).toLocaleString()}</p>
      </section>
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold text-text">Wallet history</h2>
        {(transactions ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted">No wallet transactions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {(transactions ?? []).map((transaction) => (
              <li key={transaction.id} className="flex flex-wrap justify-between gap-2 py-4">
                <div>
                  <p className="text-sm font-medium text-text">{transaction.description}</p>
                  <time className="mt-1 block text-xs text-muted">{new Date(transaction.created_at).toLocaleString()}</time>
                </div>
                <p className="font-display font-semibold text-accent-text">+₦{Number(transaction.amount).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
