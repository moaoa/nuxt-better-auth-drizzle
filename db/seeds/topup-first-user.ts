import { useDrizzle } from "~~/server/utils/drizzle";
import { user, wallet, transaction } from "~~/db/schema";
import { eq } from "drizzle-orm";

/**
 * Seeder to add $10 to the first user's wallet
 * This seeder is NOT included in the main seeders index and should be run separately
 * Usage: tsx db/seeds/topup-first-user.ts
 */
export async function topupFirstUser() {
  const db = useDrizzle();

  // Find the first user (by creation date)
  const firstUser = await db.query.user.findFirst({
    orderBy: (users, { asc }) => [asc(users.createdAt)],
  });

  if (!firstUser) {
    throw new Error("No users found in the database. Please create a user first.");
  }

  console.log(`Found first user: ${firstUser.email} (ID: ${firstUser.id})`);

  // Get or create wallet for the user
  let userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, firstUser.id),
  });

  if (!userWallet) {
    console.log("Creating wallet for user...");
    const [newWallet] = await db
      .insert(wallet)
      .values({
        userId: firstUser.id,
        balanceUsd: "0.00",
      })
      .returning();
    userWallet = newWallet;
  }

  // Add $10 to wallet
  const amountUsd = 10;
  const currentBalance = parseFloat(userWallet.balanceUsd || "0.00");
  const newBalance = currentBalance + amountUsd;

  // Update wallet balance and create transaction
  await db.transaction(async (tx) => {
    // Update wallet balance
    await tx
      .update(wallet)
      .set({
        balanceUsd: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(wallet.id, userWallet.id));

    // Create transaction record
    await tx.insert(transaction).values({
      walletId: userWallet.id,
      type: "purchase",
      amountUsd: amountUsd.toFixed(2),
      referenceType: "purchase",
      referenceId: `seeder-${Date.now()}`,
    });
  });

  console.log(
    `✓ Added $${amountUsd} to ${firstUser.email}'s wallet`
  );
  console.log(`  Previous balance: $${currentBalance.toFixed(2)}`);
  console.log(`  New balance: $${newBalance.toFixed(2)}`);
}

// Allow running directly: tsx db/seeds/topup-first-user.ts
if (process.argv[1]?.endsWith("topup-first-user.ts")) {
  topupFirstUser()
    .then(() => {
      console.log("\nSeeder completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error running seeder:", error);
      process.exit(1);
    });
}
