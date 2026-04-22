import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { getOrCreateWalletByUserId } from "~~/server/utils/wallet";

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const db = useDrizzle();

  const userWallet = await getOrCreateWalletByUserId(db, session.user.id);

  return {
    balanceUsd: parseFloat(userWallet.balanceUsd || "0.00"),
  };
});





