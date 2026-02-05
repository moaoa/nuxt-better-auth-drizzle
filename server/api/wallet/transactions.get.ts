import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { transaction, stripePayment } from "~~/db/schema";
import { eq, desc } from "drizzle-orm";
import { wallet } from "~~/db/schema";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const query = getQuery(event);

  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 20;
  const offset = (page - 1) * limit;

  const db = useDrizzle();

  // Get user wallet
  const userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, session.user.id),
  });

  if (!userWallet) {
    return {
      transactions: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  // Get transactions
  const transactions = await db.query.transaction.findMany({
    where: eq(transaction.walletId, userWallet.id),
    orderBy: [desc(transaction.createdAt)],
    limit,
    offset,
  });

  // Get total count
  const totalTransactions = await db
    .select()
    .from(transaction)
    .where(eq(transaction.walletId, userWallet.id));

  // Enrich transactions with Stripe payment info if available
  const enrichedTransactions = await Promise.all(
    transactions.map(async (tx) => {
      let stripePaymentInfo = null;

      // If transaction references a Stripe payment, fetch payment details
      if (
        tx.referenceType === "purchase" &&
        tx.referenceId?.startsWith("stripe-")
      ) {
        const paymentId = parseInt(
          tx.referenceId.replace("stripe-", ""),
          10
        );
        if (paymentId) {
          const payment = await db.query.stripePayment.findFirst({
            where: eq(stripePayment.id, paymentId),
          });

          if (payment) {
            stripePaymentInfo = {
              id: payment.id,
              status: payment.status,
              amountUsd: parseFloat(payment.amountUsd || "0"),
              stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
              completedAt: payment.completedAt,
            };
          }
        }
      }

      return {
        id: tx.id,
        walletId: tx.walletId,
        type: tx.type,
        amountUsd: tx.amountUsd,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt,
        stripePayment: stripePaymentInfo,
      };
    })
  );

  return {
    transactions: enrichedTransactions,
    pagination: {
      page,
      limit,
      total: totalTransactions.length,
      totalPages: Math.ceil(totalTransactions.length / limit),
    },
  };
});
