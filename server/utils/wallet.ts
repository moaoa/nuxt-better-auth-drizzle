import { eq } from "drizzle-orm";
import { wallet } from "~~/db/schema";

/**
 * Resolve a wallet for a user without failing on concurrent first-time requests.
 */
export async function getOrCreateWalletByUserId(db: any, userId: string) {
  const existingWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, userId),
  });

  if (existingWallet) {
    return existingWallet;
  }

  const insertedWallets = await db
    .insert(wallet)
    .values({
      userId,
      balanceUsd: "0.00",
    })
    .onConflictDoNothing({ target: wallet.userId })
    .returning();

  if (insertedWallets[0]) {
    return insertedWallets[0];
  }

  const walletAfterConflict = await db.query.wallet.findFirst({
    where: eq(wallet.userId, userId),
  });

  if (walletAfterConflict) {
    return walletAfterConflict;
  }

  throw new Error(`Failed to resolve wallet for user: ${userId}`);
}
