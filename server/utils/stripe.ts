import Stripe from "stripe";
import { useRuntimeConfig } from "#imports";

/**
 * Initialize Stripe client with secret key from runtime config
 */
function getStripeClient(): Stripe {
  const config = useRuntimeConfig();
  const secretKey = config.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(secretKey, {
    apiVersion: "2024-11-20.acacia",
  });
}

export interface CreateCheckoutSessionData {
  userId: string;
  walletId: number;
  amountUsd: number;
  creditsAmount: number;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout Session
 * @param data - Checkout session data
 * @returns Stripe Checkout Session with URL
 */
export async function createCheckoutSession(
  data: CreateCheckoutSessionData
): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeClient();
  const config = useRuntimeConfig();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Phone Call Credits",
            description: `${data.creditsAmount} credits for phone calls`,
          },
          unit_amount: Math.round(data.amountUsd * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: data.successUrl,
    cancel_url: data.cancelUrl,
    customer_email: undefined, // Will be collected by Stripe if needed
    metadata: {
      userId: data.userId,
      walletId: data.walletId.toString(),
      creditsAmount: data.creditsAmount.toString(),
      amountUsd: data.amountUsd.toString(),
    },
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Retrieve a Stripe Checkout Session
 * @param sessionId - Stripe Checkout Session ID
 * @returns Stripe Checkout Session
 */
export async function retrieveCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Validate Stripe webhook signature
 * @param payload - Raw request body as string
 * @param signature - Stripe signature from header
 * @returns Stripe event object
 */
export function validateWebhookSignature(
  payload: string,
  signature: string
): Stripe.Event {
  const config = useRuntimeConfig();
  const stripe = getStripeClient();
  const webhookSecret = config.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Webhook signature validation failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Handle successful payment
 * This function is called after webhook validation confirms payment success
 * @param session - Stripe Checkout Session
 * @returns Payment metadata
 */
export function extractPaymentMetadata(
  session: Stripe.Checkout.Session
): {
  userId: string;
  walletId: number;
  creditsAmount: number;
  amountUsd: number;
} {
  const metadata = session.metadata;

  if (!metadata) {
    throw new Error("Session metadata is missing");
  }

  const userId = metadata.userId;
  const walletId = parseInt(metadata.walletId, 10);
  const creditsAmount = parseInt(metadata.creditsAmount, 10);
  const amountUsd = parseFloat(metadata.amountUsd);

  if (!userId || !walletId || !creditsAmount || !amountUsd) {
    throw new Error("Invalid payment metadata");
  }

  return {
    userId,
    walletId,
    creditsAmount,
    amountUsd,
  };
}
