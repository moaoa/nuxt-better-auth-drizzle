import { readBody } from "h3";
import { validateWebhookSignature } from "~~/server/utils/twilio";
import { useDrizzle } from "~~/server/utils/drizzle";
import { call, wallet, transaction, callCostBreakdown } from "~~/db/schema";
import { eq } from "drizzle-orm";
import {
  calculateUserPrice,
  calculateCallCostUsd,
} from "~~/server/utils/credits";
import { twilioLogger } from "~~/lib/loggers/twilio";

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const headers = getHeaders(event);
    const signature = headers["x-twilio-signature"];

    if (!signature) {
      twilioLogger.warn("Call status webhook missing signature", {
        headers: headers,
        timestamp: new Date().toISOString(),
      });
      throw createError({
        statusCode: 401,
        statusMessage: "Missing Twilio signature",
      });
    }

    // Get request body as form data
    const body = await readBody(event);

    // Get full URL
    const protocol = headers["x-forwarded-proto"] || "http";
    const host = headers.host || "localhost:3000";
    const url = `${protocol}://${host}${event.path}`;

    // Validate signature
    const isValid = validateWebhookSignature(url, body, signature);
    if (!isValid) {
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
    const existingCall = await db.query.call.findFirst({
      where: eq(call.twilioCallSid, callSid),
    });

    if (!existingCall) {
      // Call not found - might be from another system or invalid
      twilioLogger.warn("Call status webhook: Call not found", {
        callSid: callSid,
        callStatus: callStatus,
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
      // Call completed - handle billing (idempotent)
      if (existingCall.billedAt) {
        // Already billed - skip (idempotency)
        twilioLogger.info("Call already billed, skipping", {
          callSid: callSid,
          callId: existingCall.id,
          billedAt: existingCall.billedAt,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const endedAt = new Date();
      const durationSeconds = callDuration || 0;
      const twilioDurationSeconds = callDuration || 0;

      // Only bill if call was answered (duration > 0)
      if (durationSeconds > 0 && existingCall.answeredAt) {
        // Get user wallet
        const userWallet = await tx.query.wallet.findFirst({
          where: eq(wallet.userId, existingCall.userId),
        });

        if (!userWallet) {
          throw new Error("Wallet not found for user");
        }

        // Get profit margin from config
        const profitMargin = config.CALL_PROFIT_MARGIN || 0.50;

        // Calculate costs
        const ratePerMinUsd = parseFloat(existingCall.ratePerMinUsd || "0.01");
        
        // Use Twilio price if available, otherwise calculate from rate
        let twilioPriceUsd: number;
        if (twilioPrice !== null && twilioPrice !== undefined) {
          twilioPriceUsd = twilioPrice;
        } else {
          // Fallback: calculate from rate and duration
          twilioPriceUsd = calculateCallCostUsd(ratePerMinUsd, durationSeconds);
        }

        // Calculate user price with profit margin
        const userPriceUsd = calculateUserPrice(twilioPriceUsd, profitMargin);

        // Log billing calculation
        twilioLogger.info("Calculating call billing", {
          callSid: callSid,
          callId: existingCall.id,
          durationSeconds: durationSeconds,
          twilioPriceUsd: twilioPriceUsd,
          twilioPriceUnit: twilioPriceUnit,
          profitMargin: profitMargin,
          userPriceUsd: userPriceUsd,
          timestamp: new Date().toISOString(),
        });

        // Check if user has enough balance (shouldn't happen due to pre-auth, but safety check)
        const currentBalance = parseFloat(userWallet.balanceUsd || "0.00");
        if (currentBalance < userPriceUsd) {
          // Insufficient balance - mark as failed
          twilioLogger.warn("Insufficient balance for call", {
            callSid: callSid,
            callId: existingCall.id,
            currentBalance: currentBalance,
            requiredBalance: userPriceUsd,
            timestamp: new Date().toISOString(),
          });
          await tx
            .update(call)
            .set({
              status: "failed",
              endedAt,
              durationSeconds,
            })
            .where(eq(call.id, existingCall.id));
          return;
        }

        // Deduct user price from wallet
        const newBalance = currentBalance - userPriceUsd;
        await tx
          .update(wallet)
          .set({
            balanceUsd: newBalance.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(wallet.id, userWallet.id));

        // Create transaction
        await tx.insert(transaction).values({
          walletId: userWallet.id,
          type: "call_charge",
          amountUsd: (-userPriceUsd).toFixed(2), // Negative for charges
          referenceType: "call",
          referenceId: existingCall.id.toString(),
        });

        // Create cost breakdown
        const billedMinutes = Math.ceil(durationSeconds / 60);
        await tx.insert(callCostBreakdown).values({
          callId: existingCall.id,
          ratePerMinUsd: ratePerMinUsd.toString(),
          billedMinutes,
          twilioPriceUsd: twilioPriceUsd.toFixed(6),
          twilioPriceUnit: twilioPriceUnit,
          userPriceUsd: userPriceUsd.toFixed(6),
          profitMargin: profitMargin.toFixed(4),
          twilioDurationSeconds: twilioDurationSeconds,
          pricingSnapshot: {
            ratePerMinUsd,
            durationSeconds,
            billedMinutes,
            twilioPriceUsd,
            twilioPriceUnit,
            userPriceUsd,
            profitMargin,
            twilioDurationSeconds,
          },
        });

        // Log successful billing
        twilioLogger.info("Call billed successfully", {
          callSid: callSid,
          callId: existingCall.id,
          durationSeconds: durationSeconds,
          twilioPriceUsd: twilioPriceUsd,
          userPriceUsd: userPriceUsd,
          newBalance: newBalance.toFixed(2),
          timestamp: new Date().toISOString(),
        });
      }

      // Mark as billed and completed
      await tx
        .update(call)
        .set({
          status: "completed",
          endedAt,
          durationSeconds: durationSeconds || 0,
          billedAt: new Date(),
        })
        .where(eq(call.id, existingCall.id));

      twilioLogger.info("Call marked as completed", {
        callSid: callSid,
        callId: existingCall.id,
        durationSeconds: durationSeconds || 0,
        timestamp: new Date().toISOString(),
      });
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

