import { z } from "zod";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { call } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { endCall } from "~~/server/utils/twilio";
import { billCall } from "~~/server/utils/credits";

const endCallSchema = z.object({
  callId: z.number().optional(),
  twilioCallSid: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const body = await readBody(event);
  const validated = endCallSchema.parse(body);

  const config = useRuntimeConfig();
  const db = useDrizzle();

  // Find the call by ID or Twilio Call SID
  let existingCall;
  if (validated.callId) {
    existingCall = await db.query.call.findFirst({
      where: eq(call.id, validated.callId),
    });
  } else if (validated.twilioCallSid) {
    existingCall = await db.query.call.findFirst({
      where: eq(call.twilioCallSid, validated.twilioCallSid),
    });
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: "Either callId or twilioCallSid must be provided",
    });
  }

  if (!existingCall) {
    throw createError({
      statusCode: 404,
      statusMessage: "Call not found",
    });
  }

  // Verify the call belongs to the user
  if (existingCall.userId !== session.user.id) {
    throw createError({
      statusCode: 403,
      statusMessage: "Unauthorized: Call does not belong to user",
    });
  }

  // Check if call is already completed/ended
  if (["completed", "failed", "busy", "no-answer"].includes(existingCall.status)) {
    return {
      success: true,
      message: "Call already ended",
      status: existingCall.status,
    };
  }

  try {
    // End the call via Twilio
    await endCall(existingCall.twilioCallSid);
  } catch (error) {
    console.error("Error ending call via Twilio (continuing with billing):", error);
    // Continue even if Twilio hangup fails — we still need to bill
  }

  try {
    // Set endedAt before billing so the duration calculation is accurate
    const endedAt = new Date();
    await db
      .update(call)
      .set({ endedAt })
      .where(eq(call.id, existingCall.id));

    // Re-fetch the call with the updated endedAt
    const updatedCall = await db.query.call.findFirst({
      where: eq(call.id, existingCall.id),
    });

    if (!updatedCall) {
      throw new Error("Call not found after update");
    }

    // Bill the call inside a transaction (idempotent via billedAt)
    const profitMargin = config.CALL_PROFIT_MARGIN || 0.50;
    let billingResult;

    await db.transaction(async (tx) => {
      billingResult = await billCall(tx, updatedCall, {
        profitMargin,
      });
    });

    return {
      success: true,
      message: "Call ended successfully",
      callId: existingCall.id,
      status: "completed",
      billing: billingResult,
    };
  } catch (error) {
    console.error("Error billing call:", error);

    // Even if billing fails, mark the call as completed
    await db
      .update(call)
      .set({
        status: "completed",
        endedAt: new Date(),
      })
      .where(eq(call.id, existingCall.id));

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to bill call",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
