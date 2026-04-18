import { useDrizzle } from "~~/server/utils/drizzle";
import { nowPayment, wallet, transaction } from "~~/db/schema";
import { and, eq, ne } from "drizzle-orm";
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
      console.info("NOWPayments webhook already processed", {
        paymentRecordId,
        incomingStatus: body.payment_status,
      });
      return { received: true, processed: false, reason: "already_processed" };
    }

    const newStatus = body.payment_status;
    const nextMetadata = {
      ...(paymentRecord.metadata &&
      typeof paymentRecord.metadata === "object" &&
      !Array.isArray(paymentRecord.metadata)
        ? (paymentRecord.metadata as Record<string, any>)
        : {}),
      lastIpnStatus: newStatus,
      lastIpnAt: new Date().toISOString(),
      payAddress: body.pay_address,
      purchaseId: body.purchase_id,
    };

    // Only credit wallet when payment is fully finished
    if (newStatus === "finished") {
      const creditResult = await db.transaction(async (tx) => {
        // Mark payment as completed exactly once.
        const completedRows = await tx
          .update(nowPayment)
          .set({
            status: "finished",
            nowpaymentsPaymentId: body.payment_id?.toString() || null,
            payCurrency: body.pay_currency || null,
            payAmount: body.pay_amount?.toString() || null,
            actuallyPaid: body.actually_paid?.toString() || null,
            outcomeAmount: body.outcome_amount?.toString() || null,
            completedAt: new Date(),
            updatedAt: new Date(),
            metadata: nextMetadata,
          })
          .where(
            and(eq(nowPayment.id, paymentRecord.id), ne(nowPayment.status, "finished"))
          )
          .returning({
            id: nowPayment.id,
            walletId: nowPayment.walletId,
            amountUsd: nowPayment.amountUsd,
          });

        if (completedRows.length === 0) {
          return { credited: false as const, reason: "already_processed" as const };
        }

        const referenceId = `nowpayments-${paymentRecord.id}`;

        const existingPurchaseTransaction = await tx.query.transaction.findFirst({
          where: eq(transaction.referenceId, referenceId),
        });

        if (existingPurchaseTransaction) {
          console.warn("NOWPayments duplicate transaction reference detected", {
            paymentRecordId,
            referenceId,
          });
          return { credited: false as const, reason: "duplicate_transaction" as const };
        }

        // Get current wallet balance
        const currentWallet = await tx.query.wallet.findFirst({
          where: eq(wallet.id, paymentRecord.walletId),
        });

        if (!currentWallet) {
          throw new Error(`Wallet not found for ID ${paymentRecord.walletId}`);
        }

        // Add USD to wallet
        const currentBalance = parseFloat(currentWallet.balanceUsd || "0.00");
        const amountToAdd = parseFloat(completedRows[0].amountUsd);
        const newBalance = currentBalance + amountToAdd;

        await tx
          .update(wallet)
          .set({
            balanceUsd: newBalance.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(wallet.id, paymentRecord.walletId));

        // Create transaction record
        await tx.insert(transaction).values({
          walletId: paymentRecord.walletId,
          type: "purchase",
          amountUsd: amountToAdd.toFixed(2),
          referenceType: "purchase",
          referenceId,
        });

        return { credited: true as const };
      });

      if (!creditResult.credited) {
        return { received: true, processed: false, reason: creditResult.reason };
      }

      console.info("NOWPayments payment credited", {
        paymentRecordId: paymentRecord.id,
        amountUsd: paymentRecord.amountUsd,
        status: newStatus,
      });
      return { received: true, processed: true, paymentId: paymentRecord.id, status: newStatus };
    }

    // Update non-finished statuses without changing wallet balance
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
        metadata: nextMetadata,
      })
      .where(eq(nowPayment.id, paymentRecord.id));

    // For non-finished statuses, just acknowledge
    console.info("NOWPayments payment status updated", {
      paymentRecordId: paymentRecord.id,
      status: newStatus,
    });
    return { received: true, processed: true, status: newStatus };
  } catch (error) {
    console.error("Error processing NOWPayments IPN", {
      paymentRecordId,
      error,
    });
    // Return 200 to prevent NOWPayments from retrying endlessly, but log the error
    return {
      received: true,
      processed: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});
