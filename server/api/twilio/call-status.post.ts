import { readRawBody } from "h3";
import { validateWebhookSignature } from "~~/server/utils/twilio";
import { useDrizzle } from "~~/server/utils/drizzle";
import { call } from "~~/db/schema";
import { eq, and, or, like, gte, inArray, desc } from "drizzle-orm";
import { billCall } from "~~/server/utils/credits";
import { twilioLogger } from "~~/lib/loggers/twilio";
import querystring from "querystring";

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const headers = getHeaders(event);
    const signature = headers["x-twilio-signature"];

    if (process.env.NODE_ENV !== "development" && !signature) {
      twilioLogger.warn("Call status webhook missing signature", {
        headers: headers,
        timestamp: new Date().toISOString(),
      });
      throw createError({
        statusCode: 401,
        statusMessage: "Missing Twilio signature",
      });
    }

    // Get request body as URL-encoded form data
    const rawBody = await readRawBody(event, "utf8");
    const rawBodyString = rawBody ? (typeof rawBody === "string" ? rawBody : String(rawBody)) : "";
    const parsedBody = querystring.parse(rawBodyString);
    // Normalize to Record<string, string> (querystring.parse returns string | string[] | undefined)
    const body: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsedBody)) {
      if (value !== undefined) {
        body[key] = Array.isArray(value) ? value[0] || "" : value;
      }
    }

    // Log the actual JSON of the request body
    twilioLogger.info("Call status webhook request body JSON", {
      bodyJson: JSON.stringify(body, null, 2),
      timestamp: new Date().toISOString(),
    });

    // Get full URL
    const protocol = headers["x-forwarded-proto"] || "http";
    const host = headers.host || "localhost:3000";
    const url = `${protocol}://${host}${event.path}`;

    // Validate signature
    const isValid = validateWebhookSignature(url, body, signature || "");

    if (process.env.NODE_ENV !== "development" && !isValid) {
      twilioLogger.warn("Call status webhook invalid signature", {
        url: url,
        callSid: body.CallSid,
        timestamp: new Date().toISOString(),
      });
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid Twilio signature",
      });
    }

    // Log incoming webhook request
    twilioLogger.info("Call status webhook received", {
      webhookType: "call-status",
      headers: headers,
      body: body,
      url: url,
      timestamp: new Date().toISOString(),
    });

    const callSid = body.CallSid;
    const callStatus = body.CallStatus;
    const callDuration = body.CallDuration ? parseInt(body.CallDuration) : null;
    const twilioPrice = body.Price ? parseFloat(body.Price) : null;
    const twilioPriceUnit = body.PriceUnit || "USD";

    if (!callSid) {
      twilioLogger.warn("Call status webhook missing CallSid", {
        body: body,
        timestamp: new Date().toISOString(),
      });
      throw createError({
        statusCode: 400,
        statusMessage: "Missing CallSid",
      });
    }

    const db = useDrizzle();

    // Find call by Twilio Call SID (idempotency key)
    let existingCall = await db.query.call.findFirst({
      where: eq(call.twilioCallSid, callSid),
    });

    // If not found, try to find by destination number and recent timestamp
    // This handles cases where the status webhook arrives before the voice webhook
    // updates the twilioCallSid (common for immediate failures like "busy")
    if (!existingCall) {
      const toNumber = body.To || body.Called || "";
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      if (toNumber) {
        // Try to find a recent call with matching destination
        // that hasn't been updated with the real CallSid yet
        const potentialCalls = await db.query.call.findMany({
          where: and(
            eq(call.toNumber, toNumber),
            or(
              like(call.twilioCallSid, "browser-%"),
              like(call.twilioCallSid, "pending-%")
            ),
            inArray(call.status, ["initiated", "ringing"]),
            gte(call.createdAt, fiveMinutesAgo)
          ),
          orderBy: [desc(call.createdAt)],
          limit: 1,
        });
        
        const potentialCall = potentialCalls[0];

        if (potentialCall) {
          // Update the call with the actual Twilio CallSid
          await db
            .update(call)
            .set({
              twilioCallSid: callSid,
            })
            .where(eq(call.id, potentialCall.id));

          // Fetch the updated call
          existingCall = await db.query.call.findFirst({
            where: eq(call.id, potentialCall.id),
          });

          twilioLogger.info("Call record updated with Twilio Call SID from status webhook", {
            callId: potentialCall.id,
            callSid: callSid,
            toNumber: toNumber,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    if (!existingCall) {
      // Call not found - might be from another system or invalid
      twilioLogger.warn("Call status webhook: Call not found", {
        callSid: callSid,
        callStatus: callStatus,
        toNumber: body.To || body.Called || "",
        timestamp: new Date().toISOString(),
      });
      return { status: "ignored", message: "Call not found" };
    }

    // Handle different call statuses
    await db.transaction(async (tx) => {
    if (callStatus === "answered" && !existingCall.answeredAt) {
      // Call was answered
      const answeredAt = new Date();

      await tx
        .update(call)
        .set({
          status: "answered",
          answeredAt,
        })
        .where(eq(call.id, existingCall.id));

      twilioLogger.info("Call answered", {
        callSid: callSid,
        callId: existingCall.id,
        answeredAt: answeredAt.toISOString(),
        timestamp: new Date().toISOString(),
      });

      // Note: Forced hangup is handled by cron job that runs every second
      // The cron job will check if answeredAt + maxAllowedSeconds has passed
    } else if (callStatus === "completed") {
      // Call completed - handle billing via shared billCall (idempotent via billedAt)
      const profitMargin = config.CALL_PROFIT_MARGIN || 0.50;

      // Set endedAt on the call before billing
      if (!existingCall.endedAt) {
        await tx
          .update(call)
          .set({ endedAt: new Date() })
          .where(eq(call.id, existingCall.id));
        existingCall = { ...existingCall, endedAt: new Date() };
      }

      const billingResult = await billCall(tx, existingCall, {
        profitMargin,
        twilioPriceUsd: twilioPrice,
        twilioPriceUnit,
        durationSecondsOverride: callDuration,
      });

      if (billingResult.alreadyBilled) {
        twilioLogger.info("Call already billed, skipping", {
          callSid: callSid,
          callId: existingCall.id,
          timestamp: new Date().toISOString(),
        });
      } else {
        twilioLogger.info("Call billed via webhook", {
          callSid: callSid,
          callId: existingCall.id,
          billed: billingResult.billed,
          userPriceUsd: billingResult.userPriceUsd,
          durationSeconds: billingResult.durationSeconds,
          newBalance: billingResult.newBalance,
          timestamp: new Date().toISOString(),
        });
      }
    } else if (["failed", "busy", "no-answer"].includes(callStatus)) {
      // Call failed - no billing
      await tx
        .update(call)
        .set({
          status: callStatus as "failed" | "busy" | "no-answer",
          endedAt: new Date(),
        })
        .where(eq(call.id, existingCall.id));

      twilioLogger.info("Call ended with failure status", {
        callSid: callSid,
        callId: existingCall.id,
        status: callStatus,
        timestamp: new Date().toISOString(),
      });
    } else if (callStatus === "ringing") {
      // Update status to ringing
      await tx
        .update(call)
        .set({
          status: "ringing",
        })
        .where(eq(call.id, existingCall.id));

      twilioLogger.info("Call status updated to ringing", {
        callSid: callSid,
        callId: existingCall.id,
        timestamp: new Date().toISOString(),
      });
    }
    });

    twilioLogger.info("Call status webhook processed successfully", {
      callSid: callSid,
      callStatus: callStatus,
      timestamp: new Date().toISOString(),
    });

    return { status: "processed", callSid };
  } catch (error: any) {
    // Log any errors that occur during processing
    twilioLogger.error("Error processing call status webhook", {
      error: error?.message || String(error),
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
});

