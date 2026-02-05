import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { wallet } from "~~/db/schema";
import { eq } from "drizzle-orm";

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
        balanceUsd: "0.00",
      })
      .returning();
    userWallet = newWallet;
  }

  return {
    balanceUsd: parseFloat(userWallet.balanceUsd || "0.00"),
  };
});





