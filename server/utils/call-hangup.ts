import { useDrizzle } from "~~/server/utils/drizzle";
import { call } from "~~/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { endCall } from "~~/server/utils/twilio";

/**
 * Check for active calls that have exceeded their max allowed time
 * and hang them up if necessary.
 * This function is called by a cron job every second.
 */
export async function checkAndHangupExpiredCalls() {
  const db = useDrizzle();
  const now = new Date();

  // Find all active calls that have been answered
  // We only check calls that are in "answered" status and have an answeredAt timestamp
  // (ringing calls don't have answeredAt yet, so we don't hang them up based on time)
  const activeCalls = await db.query.call.findMany({
    where: and(
      eq(call.status, "answered"),
      isNotNull(call.answeredAt)
    ),
  });

  if (activeCalls.length === 0) {
    return { checked: 0, hungup: 0 };
  }

  let hungupCount = 0;

  for (const callRecord of activeCalls) {
    if (!callRecord.answeredAt) {
      continue;
    }

    // Calculate when the call should be hung up
    const answeredAt = new Date(callRecord.answeredAt);
    const hangupTime = new Date(
      answeredAt.getTime() + callRecord.maxAllowedSeconds * 1000
    );

    // If current time is past the hangup time, hang up the call
    if (now >= hangupTime) {
      try {
        // Only hangup if call is still active
        if (!["completed", "failed", "busy", "no-answer"].includes(callRecord.status)) {
          // End the call via Twilio API
          await endCall(callRecord.twilioCallSid);

          // Update call status
          await db
            .update(call)
            .set({
              status: "completed",
              endedAt: now,
            })
            .where(eq(call.id, callRecord.id));

          console.log(
            `[Cron] Forced hangup for call ${callRecord.id} (exceeded ${callRecord.maxAllowedSeconds}s limit)`
          );
          hungupCount++;
        }
      } catch (error) {
        console.error(`[Cron] Error hanging up call ${callRecord.id}:`, error);

        // Update call status to failed if hangup failed
        try {
          await db
            .update(call)
            .set({
              status: "failed",
              endedAt: now,
            })
            .where(eq(call.id, callRecord.id));
        } catch (updateError) {
          console.error(`[Cron] Error updating call status:`, updateError);
        }
      }
    }
  }

  return {
    checked: activeCalls.length,
    hungup: hungupCount,
  };
}

