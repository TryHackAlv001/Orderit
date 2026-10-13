export const flutterwaveConfig = {
  publicKey: process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? "",
  secretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? "",
  baseUrl: "https://api.flutterwave.com/v3",
};

export interface FlutterwaveInitializePayload {
  email: string;
  amount: number;
  txRef: string;
  customer: {
    name?: string;
    email: string;
    phone?: string;
  };
  meta?: Record<string, unknown>;
}

export interface FlutterwaveInitializeResponse {
  status: string;
  message: string;
  data?: {
    link: string;
  };
}

export interface FlutterwaveVerifyResponse {
  status: string;
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    device_fingerprint: string;
    amount: number;
    currency: string;
    charged_amount: number;
    app_fee: number;
    merchant_fee: number;
    processor_response: string;
    auth_model: string;
    ip: string;
    narration: string;
    status: string;
    auth_url: string;
    payment_type: string;
    plan_id: number | null;
    plan_name: string | null;
    subscription_id: number | null;
    dump_meta: string | null;
    settlement_token: string | null;
    customer: {
      id: number;
      name: string;
      email: string;
      phone_number: string;
    };
    card: unknown;
    meta: Record<string, unknown>;
    payment_method: string;
    created_at: string;
  };
}

/**
 * Initialize a Flutterwave payment
 * @param email Customer email
 * @param amount Amount in NGN
 * @param txRef Unique transaction reference
 * @param customer Customer details
 * @param meta Additional metadata
 * @returns Payment link
 */
export async function initializePayment(
  email: string,
  amount: number,
  txRef: string,
  customer?: {
    name?: string;
    phone?: string;
  },
  meta?: Record<string, unknown>
): Promise<FlutterwaveInitializeResponse> {
  try {
    const response = await fetch(`${flutterwaveConfig.baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${flutterwaveConfig.secretKey}`,
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount,
        currency: "NGN",
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/checkout/verify?gateway=flutterwave&orderId=${encodeURIComponent(typeof meta?.orderId === "string" ? meta.orderId : "")}`,
        meta: meta || {},
        customer: {
          email,
          name: customer?.name || "Customer",
          phone_number: customer?.phone || "",
        },
        customizations: {
          title: "Naijamarket",
          description: "Secure payment for your order",
          logo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/logo.png`,
        },
      }),
    });

    const data = await response.json();
    return data as FlutterwaveInitializeResponse;
  } catch (error) {
    console.error("Flutterwave initialization error:", error);
    return {
      status: "error",
      message: "Failed to initialize payment",
    };
  }
}

/**
 * Verify a Flutterwave payment
 * @param transactionId The transaction ID from Flutterwave
 * @returns Payment status and details
 */
export async function verifyPayment(
  transactionId: string
): Promise<FlutterwaveVerifyResponse> {
  try {
    const response = await fetch(`${flutterwaveConfig.baseUrl}/transactions/${transactionId}/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${flutterwaveConfig.secretKey}`,
      },
    });

    const data = await response.json();
    return data as FlutterwaveVerifyResponse;
  } catch (error) {
    console.error("Flutterwave verification error:", error);
    return {
      status: "error",
      message: "Failed to verify payment",
    };
  }
}
