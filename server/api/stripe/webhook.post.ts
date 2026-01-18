import { readRawBody } from "h3";
import { useDrizzle } from "~~/server/utils/drizzle";
import { stripePayment, wallet, creditTransaction } from "~~/db/schema";
import { eq } from "drizzle-orm";
import {
  validateWebhookSignature,
  extractPaymentMetadata,
  retrieveCheckoutSession,
} from "~~/server/utils/stripe";

export default defineEventHandler(async (event) => {
  // Get raw body for signature validation
  const body = await readRawBody(event, "utf8");
  const headers = getHeaders(event);
  const signature = headers["stripe-signature"];

  if (!signature) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing Stripe signature",
    });
  }

  if (!body) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing request body",
    });
  }

  // Validate webhook signature
  let stripeEvent;
  try {
    stripeEvent = validateWebhookSignature(body, signature);
  } catch (error) {
    console.error("Webhook signature validation failed:", error);
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid webhook signature",
    });
  }

  const db = useDrizzle();

  // Handle different event types
  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      // Find payment record by checkout session ID
      const paymentRecord = await db.query.stripePayment.findFirst({
        where: eq(stripePayment.stripeCheckoutSessionId, session.id),
      });

      if (!paymentRecord) {
        console.error(`Payment record not found for session ${session.id}`);
        return { received: true, processed: false };
      }

      // Idempotency check: if already processed, skip
      if (paymentRecord.status === "succeeded") {
        console.log(`Payment ${paymentRecord.id} already processed`);
        return { received: true, processed: false, reason: "already_processed" };
      }

      // Extract payment metadata
      const metadata = extractPaymentMetadata(session);

      // Verify payment was successful
      if (session.payment_status !== "paid") {
        // Update status to failed
        await db
          .update(stripePayment)
          .set({
            status: "failed",
            updatedAt: new Date(),
          })
          .where(eq(stripePayment.id, paymentRecord.id));

        return { received: true, processed: false, reason: "payment_not_paid" };
      }

      // Process payment: add credits to wallet
      await db.transaction(async (tx) => {
        // Update payment status to succeeded
        await tx
          .update(stripePayment)
          .set({
            status: "succeeded",
            stripeCustomerId: session.customer as string | null,
            completedAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              ...(paymentRecord?.metadata && typeof paymentRecord.metadata === 'object' && !Array.isArray(paymentRecord.metadata) 
                ? paymentRecord.metadata as Record<string, any>
                : {}),
              paymentStatus: session.payment_status,
              customerEmail: session.customer_email,
              completedAt: new Date().toISOString(),
            },
          })
          .where(eq(stripePayment.id, paymentRecord.id));

        // Get current wallet balance
        const currentWallet = await tx.query.wallet.findFirst({
          where: eq(wallet.id, metadata.walletId),
        });

        if (!currentWallet) {
          throw new Error("Wallet not found");
        }

        // Add credits to wallet
        await tx
          .update(wallet)
          .set({
            balanceCredits: currentWallet.balanceCredits + metadata.creditsAmount,
            updatedAt: new Date(),
          })
          .where(eq(wallet.id, metadata.walletId));

        // Create credit transaction record
        await tx.insert(creditTransaction).values({
          walletId: metadata.walletId,
          type: "purchase",
          creditsAmount: metadata.creditsAmount,
          referenceType: "purchase",
          referenceId: `stripe-${paymentRecord.id}`,
        });
      });

      console.log(
        `Successfully processed payment ${paymentRecord.id} for ${metadata.creditsAmount} credits`
      );
      return { received: true, processed: true, paymentId: paymentRecord.id };
    } else if (stripeEvent.type === "checkout.session.async_payment_succeeded") {
      // Handle async payment success (e.g., bank transfers)
      const session = stripeEvent.data.object as any;

      const paymentRecord = await db.query.stripePayment.findFirst({
        where: eq(stripePayment.stripeCheckoutSessionId, session.id),
      });

      if (!paymentRecord || paymentRecord.status === "succeeded") {
        return { received: true, processed: false };
      }

      // Similar processing as checkout.session.completed
      const metadata = extractPaymentMetadata(session);

      await db.transaction(async (tx) => {
        await tx
          .update(stripePayment)
          .set({
            status: "succeeded",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(stripePayment.id, paymentRecord.id));

        const currentWallet = await tx.query.wallet.findFirst({
          where: eq(wallet.id, metadata.walletId),
        });

        if (!currentWallet) {
          throw new Error("Wallet not found");
        }

        await tx
          .update(wallet)
          .set({
            balanceCredits: currentWallet.balanceCredits + metadata.creditsAmount,
            updatedAt: new Date(),
          })
          .where(eq(wallet.id, metadata.walletId));

        await tx.insert(creditTransaction).values({
          walletId: metadata.walletId,
          type: "purchase",
          creditsAmount: metadata.creditsAmount,
          referenceType: "purchase",
          referenceId: `stripe-${paymentRecord.id}`,
        });
      });

      return { received: true, processed: true };
    } else if (
      stripeEvent.type === "checkout.session.async_payment_failed" ||
      stripeEvent.type === "payment_intent.payment_failed"
    ) {
      // Handle failed payments
      const session = stripeEvent.data.object as any;
      const sessionId = session.id || session.checkout_session;

      if (sessionId) {
        const paymentRecord = await db.query.stripePayment.findFirst({
          where: eq(stripePayment.stripeCheckoutSessionId, sessionId),
        });

        if (paymentRecord && paymentRecord.status !== "failed") {
          await db
            .update(stripePayment)
            .set({
              status: "failed",
              updatedAt: new Date(),
            })
            .where(eq(stripePayment.id, paymentRecord.id));
        }
      }

      return { received: true, processed: true };
    }

    // Acknowledge other events but don't process them
    return { received: true, processed: false, eventType: stripeEvent.type };
  } catch (error) {
    console.error("Error processing Stripe webhook:", error);
    // Return 200 to prevent Stripe from retrying, but log the error
    return {
      received: true,
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
