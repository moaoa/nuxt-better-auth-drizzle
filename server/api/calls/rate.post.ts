import { z } from "zod";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { wallet } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { useRuntimeConfig } from "#imports";
import {
  getVoiceRate,
  extractCountryCode,
  isValidE164,
} from "~~/server/utils/twilio";
import { calculateMaxAllowedSeconds } from "~~/server/utils/credits";

const rateSchema = z.object({
  toNumber: z.string().min(1),
});

/**
 * Get the call rate and maximum allowed minutes for a given phone number.
 * This endpoint is called before the user initiates a call to display
 * the rate per minute and the maximum number of minutes they can afford.
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const body = await readBody(event);
  const validated = rateSchema.parse(body);

  const config = useRuntimeConfig();
  const db = useDrizzle();

  // Validate phone number
  if (!isValidE164(validated.toNumber)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Invalid phone number format. Must be E.164 format (e.g., +1234567890)",
    });
  }

  // Get or create wallet
  let userWallet = await db.query.wallet.findFirst({
    where: eq(wallet.userId, session.user.id),
  });

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

  // Determine destination country and fetch rate
  const countryCode = extractCountryCode(validated.toNumber);
  const ratePerMinUsd = await getVoiceRate(validated.toNumber);

  // Get profit margin
  const profitMargin = config.CALL_PROFIT_MARGIN || 0.5;
  const userRatePerMinUsd = ratePerMinUsd * (1 + profitMargin);

  // Calculate max allowed seconds
  const balanceUsd = parseFloat(userWallet.balanceUsd || "0.00");
  const maxAllowedSeconds = calculateMaxAllowedSeconds(
    balanceUsd,
    ratePerMinUsd,
    profitMargin
  );
  const maxAllowedMinutes = Math.floor(maxAllowedSeconds / 60);

  return {
    ratePerMinUsd,
    userRatePerMinUsd: parseFloat(userRatePerMinUsd.toFixed(6)),
    balanceUsd,
    maxAllowedSeconds,
    maxAllowedMinutes,
    countryCode,
  };
});
