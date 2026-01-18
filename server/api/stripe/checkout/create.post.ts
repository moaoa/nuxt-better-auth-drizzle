import { z } from "zod";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { wallet, stripePayment } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { usdToCredits } from "~~/server/utils/credits";
import { createCheckoutSession } from "~~/server/utils/stripe";
import { useRuntimeConfig } from "#imports";

const createCheckoutSchema = z.object({
  amountUsd: z.number().positive().min(0.5).max(1000), // Min $0.50, Max $1000
});

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const body = await readBody(event);
  const validated = createCheckoutSchema.parse(body);

  const config = useRuntimeConfig();
  const db = useDrizzle();

  // Get or create wallet
  let userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, session.user.id),
  });

  if (!userWallet) {
    const [newWallet] = await db
      .insert(wallet)
      .values({
        userId: session.user.id,
        balanceCredits: 0,
      })
      .returning();
    userWallet = newWallet;
  }

  // Calculate credits to add
  const creditsAmount = usdToCredits(validated.amountUsd);

  // Create success and cancel URLs
  const baseUrl = config.public.BETTER_AUTH_URL || "http://localhost:3000";
  const successUrl = `${baseUrl}/app/wallet/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/app/wallet/cancel`;

  try {
    // Create Stripe Checkout Session
    const { sessionId, url } = await createCheckoutSession({
      userId: session.user.id,
      walletId: userWallet.id,
      amountUsd: validated.amountUsd,
      creditsAmount,
      successUrl,
      cancelUrl,
    });

    // Create payment record in database with status 'pending'
    await db.insert(stripePayment).values({
      userId: session.user.id,
      walletId: userWallet.id,
      stripeCheckoutSessionId: sessionId,
      amountUsd: validated.amountUsd.toString(),
      creditsAmount,
      status: "pending",
      metadata: {
        createdAt: new Date().toISOString(),
      },
    });

    return {
      checkoutUrl: url,
      sessionId,
    };
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create checkout session",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
