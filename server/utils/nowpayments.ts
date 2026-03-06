import crypto from "crypto";
import { useRuntimeConfig } from "#imports";

const NOWPAYMENTS_API_BASE = "https://api.nowpayments.io/v1";

/**
 * Get the NOWPayments API key from runtime config
 */
function getApiKey(): string {
  const config = useRuntimeConfig();
  const apiKey = config.NOWPAYMENTS_API_KEY;

  if (!apiKey) {
    throw new Error("NOWPAYMENTS_API_KEY is not configured");
  }

  return apiKey as string;
}

/**
 * Get the NOWPayments IPN secret from runtime config
 */
function getIpnSecret(): string {
  const config = useRuntimeConfig();
  const ipnSecret = config.NOWPAYMENTS_IPN_SECRET;

  if (!ipnSecret) {
    throw new Error("NOWPAYMENTS_IPN_SECRET is not configured");
  }

  return ipnSecret as string;
}

/* ---------- Types ---------- */

export interface CreateInvoiceData {
  priceAmount: number;
  priceCurrency: string;
  payCurrency?: string;
  ipnCallbackUrl: string;
  orderId: string;
  orderDescription: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateInvoiceResponse {
  id: string;
  order_id: string;
  order_description: string;
  price_amount: string;
  price_currency: string;
  pay_currency: string | null;
  ipn_callback_url: string;
  invoice_url: string;
  success_url: string;
  cancel_url: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentStatusResponse {
  payment_id: number;
  invoice_id: number | null;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  actually_paid: number;
  outcome_amount: number;
  outcome_currency: string;
  order_id: string;
  order_description: string;
  purchase_id: string;
  created_at: string;
  updated_at: string;
}

export interface IpnWebhookBody {
  payment_id: number;
  invoice_id: number | null;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  actually_paid: number;
  outcome_amount: number;
  outcome_currency: string;
  order_id: string;
  order_description: string;
  purchase_id: string;
  created_at: string;
  updated_at: string;
}

/* ---------- API Functions ---------- */

/**
 * Create a NOWPayments invoice (hosted payment page).
 * The returned invoice_url is where the user is redirected to pay.
 */
export async function createInvoice(
  data: CreateInvoiceData
): Promise<CreateInvoiceResponse> {
  const apiKey = getApiKey();

  const body: Record<string, any> = {
    price_amount: data.priceAmount,
    price_currency: data.priceCurrency,
    ipn_callback_url: data.ipnCallbackUrl,
    order_id: data.orderId,
    order_description: data.orderDescription,
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
  };

  if (data.payCurrency) {
    body.pay_currency = data.payCurrency;
  }

  const response = await fetch(`${NOWPAYMENTS_API_BASE}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `NOWPayments create invoice failed (${response.status}): ${errorText}`
    );
  }

  const result: CreateInvoiceResponse = await response.json();

  if (!result.invoice_url) {
    throw new Error("NOWPayments response missing invoice_url");
  }

  return result;
}

/**
 * Get the status of a payment by its payment ID.
 * Used as a fallback to polling if webhooks are delayed.
 */
export async function getPaymentStatus(
  paymentId: string | number
): Promise<PaymentStatusResponse> {
  const apiKey = getApiKey();

  const response = await fetch(
    `${NOWPAYMENTS_API_BASE}/payment/${paymentId}`,
    {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `NOWPayments get payment status failed (${response.status}): ${errorText}`
    );
  }

  return response.json();
}

/**
 * Validate the IPN webhook signature from NOWPayments.
 *
 * Algorithm:
 * 1. Sort the POST body keys alphabetically
 * 2. JSON.stringify the sorted object
 * 3. HMAC-SHA512 hash it with the IPN Secret Key
 * 4. Compare with x-nowpayments-sig header
 */
export function validateIpnSignature(
  body: Record<string, any>,
  signature: string
): boolean {
  const ipnSecret = getIpnSecret();

  const sortedKeys = Object.keys(body).sort();
  const sorted: Record<string, any> = {};
  for (const key of sortedKeys) {
    sorted[key] = body[key];
  }

  const hmac = crypto.createHmac("sha512", ipnSecret);
  hmac.update(JSON.stringify(sorted));
  const calculatedSig = hmac.digest("hex");

  return calculatedSig === signature;
}

/**
 * Check if the NOWPayments API is available.
 */
export async function checkApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${NOWPAYMENTS_API_BASE}/status`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.message === "OK";
  } catch {
    return false;
  }
}
