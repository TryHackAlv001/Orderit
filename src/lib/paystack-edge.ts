interface PaystackEdgePayload {
  action: "initialize" | "verify";
  orderId?: string;
  reference?: string;
}

export async function invokePaystackEdgeFunction(
  accessToken: string,
  payload: PaystackEdgePayload,
): Promise<Response> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase URL and anon key are required to invoke Paystack payments.");
  }

  return fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/paystack-payments`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}
