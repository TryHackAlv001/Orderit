import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { invokePaystackEdgeFunction } from "@/lib/paystack-edge";

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" || hostname === "[::1]";
}

function getCallbackOrigin(request: NextRequest): string {
  if (process.env.NODE_ENV === "production") {
    const configuredUrl = process.env.APP_URL;
    if (!configuredUrl) throw new Error("APP_URL is required in production");

    const appUrl = new URL(configuredUrl);
    const hostname = appUrl.hostname.toLowerCase();
    if (
      appUrl.protocol !== "https:" ||
      appUrl.pathname !== "/" ||
      appUrl.search ||
      appUrl.hash ||
      appUrl.username ||
      appUrl.password ||
      isLocalHost(hostname) ||
      hostname === "github.dev" ||
      hostname.endsWith(".github.dev")
    ) {
      throw new Error("APP_URL must be a public HTTPS origin");
    }

    let allowedOrigins: string[];
    try {
      allowedOrigins = (process.env.PAYMENT_CALLBACK_ALLOWED_ORIGINS ?? appUrl.origin)
        .split(",")
        .map((origin) => new URL(origin.trim()).origin);
    } catch {
      throw new Error("PAYMENT_CALLBACK_ALLOWED_ORIGINS must contain valid origins");
    }
    if (!allowedOrigins.includes(appUrl.origin)) {
      throw new Error("APP_URL is not an allowed payment callback origin");
    }
    return appUrl.origin;
  }

  const host = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto?.trim().toLowerCase();
  if (!host || host.includes(",") || !protocol || protocol.includes(",") || !["http", "https"].includes(protocol)) {
    throw new Error("A valid forwarded host and protocol are required in development");
  }

  const origin = new URL(`${protocol}://${host}`).origin;
  const hostname = new URL(origin).hostname.toLowerCase();
  const allowedDevelopmentHost = isLocalHost(hostname) ||
    hostname === "github.dev" || hostname.endsWith(".github.dev");
  if (!allowedDevelopmentHost || (hostname.endsWith(".github.dev") && protocol !== "https")) {
    throw new Error("Development payment callback host is not allowed");
  }
  return origin;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const callbackOrigin = getCallbackOrigin(request);
    const response = await invokePaystackEdgeFunction(session.access_token, {
      action: "initialize",
      orderId,
      callbackOrigin,
    });
    const result: unknown = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("Paystack initialize error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
