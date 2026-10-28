interface PaystackWebhookEvent {
  event?: unknown;
  data?: {
    reference?: unknown;
  };
}

interface PaystackVerifyResponse {
  status?: unknown;
  data?: {
    amount?: unknown;
    currency?: unknown;
    reference?: unknown;
    status?: unknown;
  };
}

interface PaymentAttempt {
  order_id: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required Edge Function secret: ${name}`);
  return value;
}

function constantTimeEqualHex(actual: string, expected: Uint8Array): boolean {
  const expectedHex = Array.from(expected, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const supplied = actual.toLowerCase();
  let difference = supplied.length ^ expectedHex.length;
  for (let index = 0; index < expectedHex.length; index += 1) {
    difference |= (supplied.charCodeAt(index) | 0) ^ expectedHex.charCodeAt(index);
  }
  return difference === 0;
}

async function hasValidSignature(rawBody: ArrayBuffer, signature: string | null): Promise<boolean> {
  const secret = requiredEnv("PAYSTACK_SECRET_KEY");
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody));
  return constantTimeEqualHex(signature, digest);
}

function serviceHeaders(): HeadersInit {
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function supabaseUrl(): string {
  return requiredEnv("SUPABASE_URL").replace(/\/$/, "");
}

async function processChargeSuccess(reference: string): Promise<void> {
  const secret = requiredEnv("PAYSTACK_SECRET_KEY");
  const verifyResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!verifyResponse.ok) throw new Error("Paystack transaction verification failed");
  const verified = await verifyResponse.json() as PaystackVerifyResponse;
  const transaction = verified.data;
  if (
    verified.status !== true ||
    transaction?.status !== "success" ||
    transaction.reference !== reference ||
    typeof transaction.amount !== "number" ||
    !Number.isSafeInteger(transaction.amount) ||
    typeof transaction.currency !== "string"
  ) {
    console.warn("Paystack webhook transaction did not verify", { reference });
    return;
  }

  const headers = serviceHeaders();
  const attemptParams = new URLSearchParams({
    select: "order_id",
    reference: `eq.${reference}`,
    limit: "1",
  });
  const attemptResponse = await fetch(
    `${supabaseUrl()}/rest/v1/payment_attempts?${attemptParams.toString()}`,
    { headers, signal: AbortSignal.timeout(10_000) },
  );
  if (!attemptResponse.ok) throw new Error("Unable to load payment attempt");
  const attempts = await attemptResponse.json() as PaymentAttempt[];
  const attempt = attempts[0];
  if (!attempt) {
    console.info("Ignoring Paystack webhook for unknown reference", { reference });
    return;
  }

  const eventKey = `paystack:charge.success:${reference}`;
  const eventParams = new URLSearchParams({
    select: "event_key",
    event_key: `eq.${eventKey}`,
    limit: "1",
  });
  const eventResponse = await fetch(
    `${supabaseUrl()}/rest/v1/payment_events?${eventParams.toString()}`,
    { headers, signal: AbortSignal.timeout(10_000) },
  );
  if (!eventResponse.ok) throw new Error("Unable to check payment event");
  const existingEvents = await eventResponse.json() as Array<{ event_key: string }>;
  if (existingEvents.length) {
    console.info("Ignoring duplicate Paystack webhook event", { reference });
    return;
  }

  const markResponse = await fetch(`${supabaseUrl()}/rest/v1/rpc/mark_order_paid`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_reference: reference,
      p_amount_kobo: transaction.amount,
      p_currency: transaction.currency,
      p_event_key: eventKey,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!markResponse.ok) throw new Error("Unable to record Paystack payment event");
  const outcome = await markResponse.json() as unknown;
  if (outcome === "duplicate") {
    console.info("Ignoring duplicate Paystack webhook event", { reference });
    return;
  }
  if (outcome === "needs_review") {
    console.warn("Paystack payment requires order review", { reference, orderId: attempt.order_id });
    return;
  }
  if (outcome !== "paid" && outcome !== "already_paid") {
    throw new Error("Unexpected payment confirmation outcome");
  }
  console.info("Paystack payment webhook processed", { reference, status: outcome });
}

const edgeRuntime = globalThis as typeof globalThis & {
  EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void };
};

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let rawBody: ArrayBuffer;
  try {
    rawBody = await request.arrayBuffer();
    if (!await hasValidSignature(rawBody, request.headers.get("x-paystack-signature"))) {
      return json({ error: "Invalid signature" }, 401);
    }
  } catch {
    console.error("Paystack webhook signature validation failed");
    return json({ error: "Invalid signature" }, 401);
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBody)) as PaystackWebhookEvent;
  } catch {
    return json({ error: "Invalid event payload" }, 400);
  }
  if (!event || typeof event !== "object") {
    return json({ error: "Invalid event payload" }, 400);
  }
  if (event.event !== "charge.success") return json({ received: true });

  const reference = event.data?.reference;
  if (typeof reference !== "string" || !reference) {
    console.warn("Ignoring Paystack charge.success event without a reference");
    return json({ received: true });
  }

  const processing = processChargeSuccess(reference).catch(() => {
    console.error("Paystack webhook processing failed", { reference });
  });
  if (edgeRuntime.EdgeRuntime?.waitUntil) {
    edgeRuntime.EdgeRuntime.waitUntil(processing);
  } else {
    await processing;
  }
  return json({ received: true });
});
