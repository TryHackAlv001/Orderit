type Action = "initialize" | "verify";

interface RequestBody {
  action?: unknown;
  orderId?: unknown;
  reference?: unknown;
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

async function initializePayment(
  user: AuthUser,
  orderId: string,
): Promise<Response> {
  const query = new URLSearchParams({
    select: "id,buyer_id,total,status,payment_status",
    id: `eq.${orderId}`,
    buyer_id: `eq.${user.id}`,
  });
  const order = await getOrder<Order>(query);
  if (!order) return json({ error: "Order not found" }, 404);
  if (order.status !== "pending" || order.payment_status !== "pending") {
    return json({ error: "This order is not awaiting payment" }, 409);
  }

  const amount = Number(order.total);
  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: "Order total is invalid" }, 400);
  }
  if (!user.email) return json({ error: "Account email is required" }, 400);

  const appUrl = requiredEnv("APP_URL").replace(/\/$/, "");
  const reference = `order_${order.id}_${crypto.randomUUID()}`;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: Math.round(amount * 100),
      reference,
      metadata: { orderId },
      callback_url: `${appUrl}/checkout/verify?gateway=paystack&reference=${encodeURIComponent(reference)}&orderId=${encodeURIComponent(orderId)}`,
    }),
  });
  const result = await readJson<PaystackInitializeResponse>(response);
  if (!result.status || !result.data?.authorization_url) {
    return json(
      { error: result.message || "Paystack payment initialization failed" },
      502,
    );
  }

  const updateQuery = new URLSearchParams({
    id: `eq.${orderId}`,
    buyer_id: `eq.${user.id}`,
    status: "eq.pending",
    payment_status: "eq.pending",
    select: "id",
  });
  const saved = await patchOrder(updateQuery, {
    payment_reference: reference,
    payment_method: "paystack",
  });
  if (!saved.length) {
    return json({ error: "Order payment state changed; retry checkout" }, 409);
  }

  return json({ authorization_url: result.data.authorization_url, reference });
}

async function verifyPayment(user: AuthUser, reference: string): Promise<Response> {
  const verification = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${getPaystackSecret()}` } },
  );
  const result = await readJson<PaystackVerifyResponse>(verification);
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
  if (
    transaction.currency !== "NGN" ||
    Math.round(Number(order.total) * 100) !== Number(transaction.amount)
  ) {
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
      return await initializePayment(user, body.orderId);
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
