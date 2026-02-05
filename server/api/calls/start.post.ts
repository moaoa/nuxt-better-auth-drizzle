import { z } from "zod";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { wallet, call } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { useRuntimeConfig } from "#imports";
import {
  initiateCall,
  getVoiceRate,
  extractCountryCode,
  isValidE164,
} from "~~/server/utils/twilio";
import {
  calculateMaxAllowedSeconds,
} from "~~/server/utils/credits";

const startCallSchema = z.object({
  toNumber: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const body = await readBody(event);
  const validated = startCallSchema.parse(body);

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
  const ratePerMinUsd = await getVoiceRate(countryCode, "mobile"); // Use mobile as worst-case

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

  // 6. Create call record
  const [newCall] = await db
    .insert(call)
    .values({
      userId: session.user.id,
      twilioCallSid: `pending-${Date.now()}`, // Temporary, will be updated
      fromNumber: config.TWILIO_PHONE_NUMBER,
      toNumber: validated.toNumber,
      status: "initiated",
      ratePerMinUsd: ratePerMinUsd.toString(),
      maxAllowedSeconds,
    })
    .returning();

  try {
    // 7. Initiate call via Twilio
    const baseUrl = config.public.BETTER_AUTH_URL || "http://localhost:3000";
    const webhookUrl = `${baseUrl}/api/twilio/call-status`;
    const voiceUrl = `${baseUrl}/api/twilio/voice`;

    const twilioCall = await initiateCall(
      config.TWILIO_PHONE_NUMBER,
      validated.toNumber,
      webhookUrl,
      voiceUrl
    );

    // 8. Update call with Twilio Call SID
    await db
      .update(call)
      .set({
        twilioCallSid: twilioCall.sid,
        status: "ringing",
      })
      .where(eq(call.id, newCall.id));

    // 9. Note: Forced hangup is handled by cron job that runs every second
    // The cron job checks for calls that exceed maxAllowedSeconds after answeredAt

    return {
      success: true,
      callId: newCall.id,
      twilioCallSid: twilioCall.sid,
      status: twilioCall.status,
      maxAllowedSeconds,
    };
  } catch (error) {
    // Update call status to failed
    await db
      .update(call)
      .set({
        status: "failed",
      })
      .where(eq(call.id, newCall.id));

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to initiate call",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

