import { useDrizzle } from "~~/server/utils/drizzle";
import { nowPayment, wallet, transaction } from "~~/db/schema";
import { eq } from "drizzle-orm";
import {
  validateIpnSignature,
  type IpnWebhookBody,
} from "~~/server/utils/nowpayments";

export default defineEventHandler(async (event) => {
  // Read the parsed JSON body
  const body: IpnWebhookBody = await readBody(event);
  const headers = getHeaders(event);
  const signature = headers["x-nowpayments-sig"];

  if (!signature) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing NOWPayments signature",
    });
  }

  if (!body || typeof body !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing or invalid request body",
    });
  }

  // Validate IPN signature
  if (!validateIpnSignature(body as Record<string, any>, signature)) {
    console.error("NOWPayments IPN signature validation failed");
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid IPN signature",
    });
  }

  const db = useDrizzle();

  // Extract the order_id to find our payment record
  // order_id format: "wallet-topup-{paymentRecordId}"
  const orderId = body.order_id;
  if (!orderId || !orderId.startsWith("wallet-topup-")) {
    console.error(`Invalid order_id in IPN: ${orderId}`);
    return { received: true, processed: false, reason: "invalid_order_id" };
  }

  const paymentRecordId = parseInt(orderId.replace("wallet-topup-", ""), 10);
  if (isNaN(paymentRecordId)) {
    console.error(`Could not parse payment record ID from order_id: ${orderId}`);
    return { received: true, processed: false, reason: "invalid_payment_id" };
  }

  try {
    // Find the payment record
    const paymentRecord = await db.query.nowPayment.findFirst({
      where: eq(nowPayment.id, paymentRecordId),
    });

    if (!paymentRecord) {
      console.error(`Payment record not found for ID ${paymentRecordId}`);
      return { received: true, processed: false, reason: "payment_not_found" };
    }

    // Idempotency: if already finished, skip
    if (paymentRecord.status === "finished") {
      console.log(`Payment ${paymentRecord.id} already finished, skipping`);
      return { received: true, processed: false, reason: "already_processed" };
    }

    const newStatus = body.payment_status;

    // Update the payment record with latest info from webhook
    await db
      .update(nowPayment)
      .set({
        status: newStatus as any,
        nowpaymentsPaymentId: body.payment_id?.toString() || null,
        payCurrency: body.pay_currency || null,
        payAmount: body.pay_amount?.toString() || null,
        actuallyPaid: body.actually_paid?.toString() || null,
        outcomeAmount: body.outcome_amount?.toString() || null,
        updatedAt: new Date(),
        metadata: {
          ...(paymentRecord.metadata && typeof paymentRecord.metadata === "object" && !Array.isArray(paymentRecord.metadata)
            ? (paymentRecord.metadata as Record<string, any>)
            : {}),
          lastIpnStatus: newStatus,
          lastIpnAt: new Date().toISOString(),
          payAddress: body.pay_address,
          purchaseId: body.purchase_id,
        },
      })
      .where(eq(nowPayment.id, paymentRecord.id));

    // Only credit wallet when payment is fully finished
    if (newStatus === "finished") {
      await db.transaction(async (tx) => {
        // Mark payment as completed
        await tx
          .update(nowPayment)
          .set({
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(nowPayment.id, paymentRecord.id));

        // Get current wallet balance
        const currentWallet = await tx.query.wallet.findFirst({
          where: eq(wallet.id, paymentRecord.walletId),
        });

        if (!currentWallet) {
          throw new Error(`Wallet not found for ID ${paymentRecord.walletId}`);
        }

        // Add USD to wallet
        const currentBalance = parseFloat(currentWallet.balanceUsd || "0.00");
        const amountToAdd = parseFloat(paymentRecord.amountUsd);
        const newBalance = currentBalance + amountToAdd;

        await tx
          .update(wallet)
          .set({
            balanceUsd: newBalance.toFixed(2),//TODO: check precision
            updatedAt: new Date(),
          })
          .where(eq(wallet.id, paymentRecord.walletId));

        // Create transaction record
        await tx.insert(transaction).values({
          walletId: paymentRecord.walletId,
          type: "purchase",
          amountUsd: amountToAdd.toFixed(2),//TODO: check precision
          referenceType: "purchase",
          referenceId: `nowpayments-${paymentRecord.id}`,
        });
      });

      console.log(
        `Successfully processed NOWPayments payment ${paymentRecord.id} for $${paymentRecord.amountUsd}`
      );
      return { received: true, processed: true, paymentId: paymentRecord.id };
    }

    // For non-finished statuses, just acknowledge
    console.log(
      `NOWPayments IPN: payment ${paymentRecord.id} status updated to ${newStatus}`
    );
    return { received: true, processed: true, status: newStatus };
  } catch (error) {
    console.error("Error processing NOWPayments IPN:", error);
    // Return 200 to prevent NOWPayments from retrying endlessly, but log the error
    return {
      received: true,
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
