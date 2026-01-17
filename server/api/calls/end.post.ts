import { z } from "zod";
import { requireUserSession } from "~~/server/utils/session";
import { useDrizzle } from "~~/server/utils/drizzle";
import { call } from "~~/db/schema";
import { eq } from "drizzle-orm";
import { endCall } from "~~/server/utils/twilio";

const endCallSchema = z.object({
  callId: z.number().optional(),
  twilioCallSid: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event);
  const body = await readBody(event);
  const validated = endCallSchema.parse(body);

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

    // Update call status in database
    await db
      .update(call)
      .set({
        status: "completed",
        endedAt: new Date(),
      })
      .where(eq(call.id, existingCall.id));

    return {
      success: true,
      message: "Call ended successfully",
      callId: existingCall.id,
      status: "completed",
    };
  } catch (error) {
    console.error("Error ending call:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to end call",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
