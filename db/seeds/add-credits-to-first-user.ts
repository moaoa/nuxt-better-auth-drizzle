import { useDrizzle } from "~~/server/utils/drizzle";
import { user, wallet, creditTransaction } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { usdToCredits } from "~~/server/utils/credits";

/**
 * Seeder to add $10 worth of credits to the first user's wallet
 * This seeder is NOT included in the main seeders index and should be run separately
 */
export async function addCreditsToFirstUser() {
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
        balanceCredits: 0,
      })
      .returning();
    userWallet = newWallet;
  }

  // Calculate credits for $10 (1 credit = $0.01, so $10 = 1000 credits)
  const amountUsd = 10;
  const creditsToAdd = usdToCredits(amountUsd);
  const newBalance = userWallet.balanceCredits + creditsToAdd;

  // Update wallet balance
  await db
    .update(wallet)
    .set({
      balanceCredits: newBalance,
      updatedAt: new Date(),
    })
    .where(eq(wallet.id, userWallet.id));

  // Create credit transaction record
  await db.insert(creditTransaction).values({
    walletId: userWallet.id,
    type: "purchase",
    creditsAmount: creditsToAdd,
    referenceType: null,
    referenceId: null,
  });

  console.log(
    `✓ Added $${amountUsd} (${creditsToAdd} credits) to ${firstUser.email}'s wallet`
  );
  console.log(`  Previous balance: ${userWallet.balanceCredits} credits`);
  console.log(`  New balance: ${newBalance} credits`);
}

// Allow running directly: tsx db/seeds/add-credits-to-first-user.ts
if (process.argv[1]?.endsWith("add-credits-to-first-user.ts")) {
  addCreditsToFirstUser()
    .then(() => {
      console.log("\nSeeder completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error running seeder:", error);
      process.exit(1);
    });
}
