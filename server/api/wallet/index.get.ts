import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { wallet } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { creditsToUsd } from "~~/server/utils/credits";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const db = useDrizzle();

  // Get or create wallet for user
  let userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, session.user.id),
  });

  // Create wallet if it doesn't exist
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

  return {
    balanceCredits: userWallet.balanceCredits,
    balanceUsd: creditsToUsd(userWallet.balanceCredits),
  };
});





