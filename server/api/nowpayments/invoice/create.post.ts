import { z } from "zod";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { wallet, nowPayment } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { createInvoice } from "~~/server/utils/nowpayments";
import { useRuntimeConfig } from "#imports";
import {
  isValidTopupAmount,
  MIN_TOPUP_AMOUNT_USD,
  MAX_TOPUP_AMOUNT_USD,
} from "~~/lib/wallet-topup";

const createInvoiceSchema = z.object({
  amountUsd: z
    .number()
    .refine(isValidTopupAmount, {
      message: `Invalid top-up amount. Use an amount between $${MIN_TOPUP_AMOUNT_USD.toFixed(2)} and $${MAX_TOPUP_AMOUNT_USD.toFixed(2)} with up to 2 decimal places.`,
    }),
});

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const body = await readBody(event);
  const validated = createInvoiceSchema.parse(body);

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
        balanceUsd: "0.00",
      })
      .returning();
    userWallet = newWallet;
  }

  // Create payment record in database with status 'pending'
  const [paymentRecord] = await db
    .insert(nowPayment)
    .values({
      userId: session.user.id,
      walletId: userWallet.id,
      amountUsd: validated.amountUsd.toString(),
      status: "pending",
      metadata: {
        createdAt: new Date().toISOString(),
      },
    })
    .returning();

  // Build URLs
  const baseUrl = config.NOWPAYMENTS_BASE_URL || "http://localhost:3000";
  const successUrl = `${baseUrl}/app/wallet/success?payment_id=${paymentRecord.id}`;
  const cancelUrl = `${baseUrl}/app/wallet/cancel`;
  const ipnCallbackUrl = `${baseUrl}/api/nowpayments/webhook`;

  try {
    // Create NOWPayments invoice
    const invoice = await createInvoice({
      priceAmount: validated.amountUsd,
      priceCurrency: "usd",
      ipnCallbackUrl,
      orderId: `wallet-topup-${paymentRecord.id}`,
      orderDescription: `Add $${validated.amountUsd.toFixed(2)} to wallet`,
      successUrl,
      cancelUrl,
    });

    // Update payment record with NOWPayments invoice ID and URL
    await db
      .update(nowPayment)
      .set({
        nowpaymentsInvoiceId: invoice.id,
        invoiceUrl: invoice.invoice_url,
        updatedAt: new Date(),
      })
      .where(eq(nowPayment.id, paymentRecord.id));

    return {
      invoiceUrl: invoice.invoice_url,
      invoiceId: invoice.id,
      paymentId: paymentRecord.id,
    };
  } catch (error) {
    // TODO: add rollback to database
    // Mark payment as failed if invoice creation fails
    await db
      .update(nowPayment)
      .set({
        status: "failed",
        updatedAt: new Date(),
        metadata: {
          createdAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
      .where(eq(nowPayment.id, paymentRecord.id));

    console.error("Error creating NOWPayments invoice:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create payment invoice",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
