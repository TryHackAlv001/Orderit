import { toKobo } from "./money.ts";

type Action = "initialize" | "verify";

interface RequestBody {
  action?: unknown;
  orderId?: unknown;
  reference?: unknown;
  callbackOrigin?: unknown;
}

interface AuthUser {
  id: string;
  email?: string;
}

interface Order {
  id: string;
  buyer_id: string;
  total: number | string;
  status: string;
  payment_status: string;
  payment_reference?: string | null;
  payment_authorization_url?: string | null;
  payment_method?: string | null;
  paid_at?: string | null;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    amount: number;
    currency: string;
    metadata?: { orderId?: string };
    reference: string;
    status: string;
  };
}

interface SupabaseError {
  message?: string;
  error?: string;
  details?: string;
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

function supabaseUrl(): string {
  return requiredEnv("SUPABASE_URL").replace(/\/$/, "");
}

function getPaystackSecret(): string {
  return requiredEnv("PAYSTACK_SECRET_KEY");
}

function serviceHeaders(prefer?: string): HeadersInit {
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Expected JSON response (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const error = body as SupabaseError | null;
    throw new Error(
      error?.message || error?.error || `Request failed (HTTP ${response.status})`,
    );
  }
  return body as T;
}

async function authenticateUser(accessToken: string): Promise<AuthUser | null> {
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: requiredEnv("SUPABASE_ANON_KEY"),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401 || response.status === 403) return null;
  return await readJson<AuthUser>(response);
}

async function getOrder<T>(query: URLSearchParams): Promise<T | null> {
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/orders?${query.toString()}`,
    { headers: serviceHeaders() },
  );
  const rows = await readJson<T[]>(response);
  return rows[0] ?? null;
}

async function patchOrder(
  query: URLSearchParams,
  values: Partial<Order>,
): Promise<Order[]> {
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/orders?${query.toString()}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders("return=representation"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(values),
    },
  );
  return await readJson<Order[]>(response);
}

async function beginPaystackAttempt(orderId: string, reference: string): Promise<boolean> {
  const response = await fetch(`${supabaseUrl()}/rest/v1/rpc/begin_paystack_attempt`, {
    method: "POST",
    headers: {
      ...serviceHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_order_id: orderId, p_reference: reference }),
  });
  return await readJson<boolean>(response);
}

async function updateAttemptStatus(
  reference: string,
  status: "initialized" | "failed" | "paid",
): Promise<void> {
  const query = new URLSearchParams({ reference: `eq.${reference}` });
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/payment_attempts?${query.toString()}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
  );
  await readJson<unknown>(response);
}

async function verifyPaystackReference(reference: string): Promise<PaystackVerifyResponse> {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${getPaystackSecret()}` } },
  );
  return await readJson<PaystackVerifyResponse>(response);
}

async function clearAttempt(orderId: string, userId: string, reference: string): Promise<boolean> {
  await updateAttemptStatus(reference, "failed");
  const query = new URLSearchParams({
    id: `eq.${orderId}`,
    buyer_id: `eq.${userId}`,
    payment_reference: `eq.${reference}`,
  });
  const cleared = await patchOrder(query, {
    payment_reference: null,
    payment_method: "pending",
    payment_authorization_url: null,
  });
  return cleared.length > 0;
}

async function initializePayment(
  user: AuthUser,
  orderId: string,
  callbackOrigin: string,
): Promise<Response> {
  const query = new URLSearchParams({
    select: "id,buyer_id,total,status,payment_status,payment_reference,payment_authorization_url",
    id: `eq.${orderId}`,
    buyer_id: `eq.${user.id}`,
  });
  const order = await getOrder<Order>(query);
  if (!order) return json({ error: "Order not found" }, 404);
  if (order.status !== "pending" || order.payment_status !== "pending") {
    return json({ error: "This order is not awaiting payment" }, 409);
  }

  if (order.payment_reference) {
    let previousAttempt: PaystackVerifyResponse;
    try {
      previousAttempt = await verifyPaystackReference(order.payment_reference);
    } catch (error) {
      console.error("Unable to verify previous Paystack attempt:", error);
      return json({ error: "Unable to verify the previous payment attempt; retry shortly" }, 502);
    }
    if (previousAttempt.status && previousAttempt.data?.status === "success") {
      return await verifyPayment(user, order.payment_reference);
    }
    if (previousAttempt.status && !previousAttempt.data) {
      return json({ error: "Unable to verify the previous payment attempt; retry shortly" }, 502);
    }
    if (order.payment_authorization_url) {
      return json({
        authorization_url: order.payment_authorization_url,
        reference: order.payment_reference,
      });
    }
    const cleared = await clearAttempt(order.id, user.id, order.payment_reference);
    if (!cleared) {
      return json({ error: "The previous payment attempt could not be cleared; retry shortly" }, 409);
    }
  }

  const amountKobo = toKobo(order.total);
  if (amountKobo === null || amountKobo <= 0) {
    return json({ error: "Order total is invalid" }, 400);
  }
  if (!user.email) return json({ error: "Account email is required" }, 400);

  const reference = `order_${order.id}_${crypto.randomUUID()}`;
  let reserved: boolean;
  try {
    reserved = await beginPaystackAttempt(order.id, reference);
  } catch (error) {
    const latest = await getOrder<Order>(query);
    if (latest?.payment_reference) {
      if (latest.payment_authorization_url) {
        return json({
          authorization_url: latest.payment_authorization_url,
          reference: latest.payment_reference,
        });
      }
      return json({ error: "Payment initialization is already in progress; retry shortly" }, 409);
    }
    console.error("Unable to reserve Paystack attempt:", error);
    return json({ error: "Unable to reserve a payment attempt" }, 502);
  }
  if (!reserved) {
    const latest = await getOrder<Order>(query);
    if (latest?.payment_reference && latest.payment_authorization_url) {
      return json({
        authorization_url: latest.payment_authorization_url,
        reference: latest.payment_reference,
      });
    }
    return json({ error: "Payment initialization is already in progress; retry shortly" }, 409);
  }

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getPaystackSecret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountKobo,
        reference,
        metadata: { orderId },
        callback_url: `${callbackOrigin}/checkout/verify?gateway=paystack&reference=${encodeURIComponent(reference)}&orderId=${encodeURIComponent(orderId)}`,
      }),
    });
    const result = await readJson<PaystackInitializeResponse>(response);
    if (!result.status || !result.data?.authorization_url) {
      await clearAttempt(order.id, user.id, reference);
      return json(
        { error: result.message || "Paystack payment initialization failed" },
        502,
      );
    }

    const saveQuery = new URLSearchParams({
      id: `eq.${order.id}`,
      buyer_id: `eq.${user.id}`,
      payment_reference: `eq.${reference}`,
    });
    const saved = await patchOrder(saveQuery, {
      payment_authorization_url: result.data.authorization_url,
    });
    if (!saved.length) {
      return json({ error: "Payment initialized but could not be saved; retry shortly" }, 502);
    }
    await updateAttemptStatus(reference, "initialized");

    return json({ authorization_url: result.data.authorization_url, reference });
  } catch (error) {
    try {
      const previousAttempt = await verifyPaystackReference(reference);
      if (previousAttempt.status && previousAttempt.data?.status === "success") {
        return await verifyPayment(user, reference);
      }
      if (!await clearAttempt(order.id, user.id, reference)) {
        return json({ error: "The failed payment attempt could not be cleared" }, 502);
      }
    } catch (verificationError) {
      console.error("Unable to resolve Paystack initialization outcome:", verificationError);
      return json({ error: "Payment outcome is uncertain; retry shortly" }, 502);
    }
    console.error("Paystack initialization failed:", error);
    return json({ error: "Paystack payment initialization failed" }, 502);
  }
}

async function verifyPayment(user: AuthUser, reference: string): Promise<Response> {
  const result = await verifyPaystackReference(reference);
  if (!result.status || result.data?.status !== "success") {
    return json({ success: false, error: "Payment not successful" }, 400);
  }

  const transaction = result.data;
  const orderId = transaction.metadata?.orderId;
  if (!orderId || transaction.reference !== reference) {
    return json({ success: false, error: "Order ID not found" }, 400);
  }

  const query = new URLSearchParams({
    select: "id,buyer_id,total,payment_reference,payment_method,payment_status,status",
    id: `eq.${orderId}`,
    buyer_id: `eq.${user.id}`,
  });
  const order = await getOrder<Order>(query);
  if (!order) return json({ success: false, error: "Order not found" }, 404);
  if (order.payment_reference !== reference || order.payment_method !== "paystack") {
    return json({ success: false, error: "Payment reference does not match this order" }, 400);
  }
  const orderAmountKobo = toKobo(order.total);
  if (transaction.currency !== "NGN" || orderAmountKobo === null || orderAmountKobo !== transaction.amount) {
    return json({ success: false, error: "Paid amount or currency does not match the order" }, 400);
  }

  if (order.payment_status !== "paid") {
    const updateQuery = new URLSearchParams({
      id: `eq.${orderId}`,
      buyer_id: `eq.${user.id}`,
      payment_status: "eq.pending",
      select: "id",
    });
    const updated = await patchOrder(updateQuery, {
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      status: "confirmed",
    });

    if (!updated.length) {
      const latestQuery = new URLSearchParams({
        select: "payment_status",
        id: `eq.${orderId}`,
        buyer_id: `eq.${user.id}`,
      });
      const latest = await getOrder<{ payment_status: string }>(latestQuery);
      if (latest?.payment_status !== "paid") {
        return json({ success: false, error: "Order payment state changed; retry verification" }, 409);
      }
    }
  }
  await updateAttemptStatus(reference, "paid");

  const itemsQuery = new URLSearchParams({
    select: "product_id",
    order_id: `eq.${orderId}`,
  });
  const itemsResponse = await fetch(
    `${supabaseUrl()}/rest/v1/order_items?${itemsQuery.toString()}`,
    { headers: serviceHeaders() },
  );
  const orderItems = await readJson<{ product_id: string }[]>(itemsResponse);
  const productIds = Array.from(new Set(orderItems.map((item) => item.product_id)));

  if (productIds.length) {
    const cartQuery = new URLSearchParams({
      user_id: `eq.${user.id}`,
      product_id: `in.(${productIds.join(",")})`,
    });
    const cartResponse = await fetch(
      `${supabaseUrl()}/rest/v1/cart_items?${cartQuery.toString()}`,
      {
        method: "DELETE",
        headers: serviceHeaders(),
      },
    );
    if (!cartResponse.ok) {
      const message = await cartResponse.text();
      console.error("Unable to remove purchased items from cart:", message);
      return json({ success: false, error: "Payment verified but cart cleanup failed" }, 500);
    }
  }

  return json({ success: true, orderId, productIds });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = request.headers.get("Authorization");
    const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) return json({ error: "Unauthenticated" }, 401);

    const user = await authenticateUser(accessToken);
    if (!user) return json({ error: "Unauthenticated" }, 401);

    const body = (await request.json()) as RequestBody;
    if (body.action === "initialize") {
      if (typeof body.orderId !== "string" || !body.orderId) {
        return json({ error: "Order ID is required" }, 400);
      }
      if (typeof body.callbackOrigin !== "string" || !body.callbackOrigin) {
        return json({ error: "Payment callback origin is required" }, 400);
      }
      return await initializePayment(user, body.orderId, body.callbackOrigin);
    }

    if (body.action === "verify") {
      if (typeof body.reference !== "string" || !body.reference) {
        return json({ error: "Missing reference" }, 400);
      }
      return await verifyPayment(user, body.reference);
    }

    return json({ error: "Unsupported Paystack action" }, 400);
  } catch (error) {
    console.error("Paystack Edge Function error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
