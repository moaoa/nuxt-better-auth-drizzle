import { z } from "zod";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { wallet, call } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { useRuntimeConfig } from "#imports";
import {
  getVoiceRate,
  extractCountryCode,
  isValidE164,
} from "~~/server/utils/twilio";
import {
  calculateMaxAllowedSeconds,
} from "~~/server/utils/credits";

const browserStartCallSchema = z.object({
  toNumber: z.string().min(1),
});

/**
 * Create a call record for browser-initiated calls
 * The actual call is made from the browser using Twilio Voice SDK
 * This endpoint just creates the record and validates balance
 */
export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const body = await readBody(event);
  const validated = browserStartCallSchema.parse(body);

  const config = useRuntimeConfig();
  const db = useDrizzle();

  // 1. Validate phone number (E.164 format)
  if (!isValidE164(validated.toNumber)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid phone number format. Must be E.164 format (e.g., +1234567890)",
    });
  }

  // 2. Get or create wallet
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

  // 3. Determine destination country and fetch rate
  const countryCode = extractCountryCode(validated.toNumber);
  const ratePerMinUsd = await getVoiceRate(validated.toNumber);

  // 4. Get profit margin
  const profitMargin = config.CALL_PROFIT_MARGIN || 0.50;
  const userRatePerMinUsd = ratePerMinUsd * (1 + profitMargin);

  // 5. Check if user has at least 1 minute worth of balance
  const balanceUsd = parseFloat(userWallet.balanceUsd || "0.00");
  if (balanceUsd < userRatePerMinUsd) {
    throw createError({
      statusCode: 400,
      statusMessage: "Insufficient balance. Please add more funds to make calls.",
    });
  }

  // 6. Calculate max allowed seconds
  const maxAllowedSeconds = calculateMaxAllowedSeconds(
    balanceUsd,
    ratePerMinUsd,
    profitMargin
  );

  if (maxAllowedSeconds < 60) {
    throw createError({
      statusCode: 400,
      statusMessage: "Insufficient credits for a minimum 1-minute call.",
    });
  }

  // 6. Create call record (status will be updated by webhooks)
  const [newCall] = await db
    .insert(call)
    .values({
      userId: session.user.id,
      twilioCallSid: `browser-${Date.now()}`, // Temporary, will be updated by webhook
      fromNumber: config.TWILIO_PHONE_NUMBER,
      toNumber: validated.toNumber,
      status: "initiated",
      ratePerMinUsd: ratePerMinUsd.toString(),
      maxAllowedSeconds,
    })
    .returning();

  return {
    success: true,
    callId: newCall.id,
    toNumber: validated.toNumber,
    maxAllowedSeconds,
    ratePerMinUsd,
  };
});
