import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { creditTransaction, stripePayment } from "~~/db/schema";
import { eq, desc, and } from "drizzle-orm";
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

  // Get credit transactions
  const transactions = await db.query.creditTransaction.findMany({
    where: eq(creditTransaction.walletId, userWallet.id),
    orderBy: [desc(creditTransaction.createdAt)],
    limit,
    offset,
  });

  // Get total count
  const totalTransactions = await db
    .select()
    .from(creditTransaction)
    .where(eq(creditTransaction.walletId, userWallet.id));

  // Enrich transactions with Stripe payment info if available
  const enrichedTransactions = await Promise.all(
    transactions.map(async (transaction) => {
      let stripePaymentInfo = null;

      // If transaction references a Stripe payment, fetch payment details
      if (
        transaction.referenceType === "purchase" &&
        transaction.referenceId?.startsWith("stripe-")
      ) {
        const paymentId = parseInt(
          transaction.referenceId.replace("stripe-", ""),
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
        ...transaction,
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
