const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "BUYER_EMAIL",
  "BUYER_PASSWORD",
  "VENDOR_EMAIL",
  "VENDOR_PASSWORD",
  "ORDER_ID",
  "PAYSTACK_REFERENCE",
  "APP_BASE_URL",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing required environment variable names: ${missing.join(", ")}`);
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const orderId = process.env.ORDER_ID;

async function signIn(email, password) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Supabase sign-in failed (HTTP ${response.status})`);
  }
  return response.json();
}

async function attemptClientPaymentUpdate(accessToken, actor) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ payment_status: "paid" }),
    },
  );
  if (response.ok) {
    throw new Error(`${actor} payment_status write unexpectedly succeeded`);
  }
  console.log(`${actor} direct payment_status write denied (HTTP ${response.status})`);
}

function makeAuthCookie(session, projectRef) {
  const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `sb-${projectRef}-auth-token=base64-${encoded}`;
}

const buyer = await signIn(process.env.BUYER_EMAIL, process.env.BUYER_PASSWORD);
const vendor = await signIn(process.env.VENDOR_EMAIL, process.env.VENDOR_PASSWORD);
await attemptClientPaymentUpdate(buyer.access_token, "Buyer");
await attemptClientPaymentUpdate(vendor.access_token, "Vendor");

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const verifyUrl = new URL(
  "/api/payments/paystack/verify",
  process.env.APP_BASE_URL,
);
verifyUrl.searchParams.set("reference", process.env.PAYSTACK_REFERENCE);
const verifyResponse = await fetch(verifyUrl, {
  headers: {
    Cookie: makeAuthCookie(buyer, projectRef),
  },
});
let verifyResult;
try {
  verifyResult = await verifyResponse.json();
} catch {
  throw new Error(`Paystack verification returned invalid JSON (HTTP ${verifyResponse.status})`);
}
if (!verifyResponse.ok || verifyResult.success !== true || verifyResult.orderId !== orderId) {
  throw new Error(`Paystack verify route did not confirm the expected order (HTTP ${verifyResponse.status})`);
}
console.log("Paystack verify route succeeded for the test order");
