import { z } from "zod";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { wallet, creditTransaction } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { usdToCredits } from "~~/server/utils/credits";

const purchaseSchema = z.object({
  amountUsd: z.number().positive().min(0.01),
});

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const body = await readBody(event);
  const validated = purchaseSchema.parse(body);

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
  const creditsToAdd = usdToCredits(validated.amountUsd);

  // Transaction: Update wallet and create transaction record
  await db.transaction(async (tx) => {
    // Update wallet balance
    await tx
      .update(wallet)
      .set({
        balanceCredits: userWallet.balanceCredits + creditsToAdd,
        updatedAt: new Date(),
      })
      .where(eq(wallet.id, userWallet.id));

    // Create credit transaction
    await tx.insert(creditTransaction).values({
      walletId: userWallet.id,
      type: "purchase",
      creditsAmount: creditsToAdd,
      referenceType: "purchase",
      referenceId: `purchase-${Date.now()}`,
    });
  });

  // Fetch updated wallet
  const updatedWallet = await db.query.wallet.findFirst({
    where: eq(wallet.id, userWallet.id),
  });

  return {
    transactionId: userWallet.id,
    newBalance: updatedWallet?.balanceCredits || 0,
  };
});





