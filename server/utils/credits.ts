/**
 * USD-Based Pricing Utilities
 * All calculations work directly with USD amounts.
 */

import { eq } from "drizzle-orm";
import { wallet, transaction, callCostBreakdown, call } from "~~/db/schema";
import type { Call } from "~~/db/schema";

/**
 * Calculate user price with profit margin
 * @param twilioCostUsd - Actual cost from Twilio
 * @param profitMargin - Profit margin as decimal (e.g., 0.50 = 50%)
 * @returns User charge in USD
 */
export function calculateUserPrice(
  twilioCostUsd: number,
  profitMargin: number
): number {
  if (twilioCostUsd < 0) {
    throw new Error("Twilio cost cannot be negative");
  }
  if (profitMargin < 0) {
    throw new Error("Profit margin cannot be negative");
  }
  return twilioCostUsd * (1 + profitMargin);
}

/**
 * Calculate call cost in USD
 * Rounds up per minute (minimum 1 minute charge)
 * 
 * @param ratePerMinUsd - Rate per minute in USD
 * @param durationSeconds - Call duration in seconds
 * @returns Cost in USD (always rounds up to nearest minute)
 */
export function calculateCallCostUsd(
  ratePerMinUsd: number,
  durationSeconds: number
): number {
  if (ratePerMinUsd < 0) {
    throw new Error("Rate per minute cannot be negative");
  }
  if (durationSeconds < 0) {
    throw new Error("Duration cannot be negative");
  }

  // Round up to nearest minute (minimum 1 minute)
  const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
  return ratePerMinUsd * minutes;
}

/**
 * Calculate maximum allowed seconds for a call based on USD balance
 * 
 * @param balanceUsd - Current USD balance
 * @param ratePerMinUsd - Rate per minute in USD
 * @param profitMargin - Profit margin as decimal (e.g., 0.50 = 50%)
 * @returns Maximum seconds allowed (0 if insufficient balance)
 */
export function calculateMaxAllowedSeconds(
  balanceUsd: number,
  ratePerMinUsd: number,
  profitMargin: number = 0
): number {
  if (balanceUsd < 0) {
    return 0;
  }
  if (ratePerMinUsd <= 0) {
    return 0;
  }

  // Calculate user rate per minute (with profit margin)
  const userRatePerMinUsd = ratePerMinUsd * (1 + profitMargin);
  if (userRatePerMinUsd === 0) {
    return 0;
  }

  // Calculate how many minutes we can afford
  const affordableMinutes = Math.floor(balanceUsd / userRatePerMinUsd);
  return affordableMinutes * 60;
}

/**
 * Result of billing a call
 */
export interface BillCallResult {
  billed: boolean;
  userPriceUsd: number;
  newBalance: number;
  durationSeconds: number;
  billedMinutes: number;
  alreadyBilled?: boolean;
  noBillingNeeded?: boolean;
}

/**
 * Bill a completed call: deduct wallet, create transaction and cost breakdown.
 * This function is idempotent — it checks `billedAt` to avoid double-billing.
 *
 * @param tx - Drizzle transaction or db instance (must support .query, .update, .insert)
 * @param existingCall - The call record from the database
 * @param opts.profitMargin - Profit margin as decimal (e.g., 0.50 = 50%)
 * @param opts.twilioPriceUsd - Actual Twilio price if available (from webhook)
 * @param opts.twilioPriceUnit - Currency unit for Twilio price (default "USD")
 * @param opts.durationSecondsOverride - Override duration (e.g. from Twilio webhook CallDuration)
 * @returns BillCallResult
 */
export async function billCall(
  tx: any,
  existingCall: Call,
  opts: {
    profitMargin: number;
    twilioPriceUsd?: number | null;
    twilioPriceUnit?: string;
    durationSecondsOverride?: number | null;
  }
): Promise<BillCallResult> {
  const { profitMargin, twilioPriceUnit = "USD" } = opts;

  // Idempotency: already billed
  if (existingCall.billedAt) {
    return {
      billed: false,
      alreadyBilled: true,
      userPriceUsd: 0,
      newBalance: 0,
      durationSeconds: existingCall.durationSeconds || 0,
      billedMinutes: 0,
    };
  }

  // Calculate duration
  let durationSeconds: number;
  if (opts.durationSecondsOverride != null && opts.durationSecondsOverride > 0) {
    durationSeconds = opts.durationSecondsOverride;
  } else if (existingCall.answeredAt) {
    const answeredAt = new Date(existingCall.answeredAt);
    const endedAt = existingCall.endedAt
      ? new Date(existingCall.endedAt)
      : new Date();
    durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - answeredAt.getTime()) / 1000)
    );
  } else {
    durationSeconds = 0;
  }

  // No billing if call was never answered or had zero duration
  if (durationSeconds <= 0 || !existingCall.answeredAt) {
    // Still mark as billed so we don't retry
    await tx
      .update(call)
      .set({
        status: "completed",
        endedAt: existingCall.endedAt || new Date(),
        durationSeconds: 0,
        billedAt: new Date(),
      })
      .where(eq(call.id, existingCall.id));

    return {
      billed: false,
      noBillingNeeded: true,
      userPriceUsd: 0,
      newBalance: 0,
      durationSeconds: 0,
      billedMinutes: 0,
    };
  }

  // Get user wallet
  const userWallet = await tx.query.wallet.findFirst({
    where: eq(wallet.userId, existingCall.userId),
  });

  if (!userWallet) {
    throw new Error("Wallet not found for user");
  }

  // Calculate costs
  const ratePerMinUsd = parseFloat(existingCall.ratePerMinUsd || "0.01");

  // Use Twilio price if available, otherwise calculate from rate
  let twilioPriceUsd: number;
  if (opts.twilioPriceUsd != null && opts.twilioPriceUsd > 0) {
    twilioPriceUsd = opts.twilioPriceUsd;
  } else {
    twilioPriceUsd = calculateCallCostUsd(ratePerMinUsd, durationSeconds);
  }

  // Calculate user price with profit margin
  const userPriceUsd = calculateUserPrice(twilioPriceUsd, profitMargin);

  // Check balance
  const currentBalance = parseFloat(userWallet.balanceUsd || "0.00");
  if (currentBalance < userPriceUsd) {
    // Bill whatever balance they have left (don't fail the call)
    const chargeAmount = Math.min(userPriceUsd, currentBalance);
    const newBalance = currentBalance - chargeAmount;

    await tx
      .update(wallet)
      .set({
        balanceUsd: newBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(wallet.id, userWallet.id));

    if (chargeAmount > 0) {
      await tx.insert(transaction).values({
        walletId: userWallet.id,
        type: "call_charge",
        amountUsd: (-chargeAmount).toFixed(2),
        referenceType: "call",
        referenceId: existingCall.id.toString(),
      });
    }

    await tx
      .update(call)
      .set({
        status: "completed",
        endedAt: existingCall.endedAt || new Date(),
        durationSeconds,
        billedAt: new Date(),
      })
      .where(eq(call.id, existingCall.id));

    const billedMinutes = Math.ceil(durationSeconds / 60);
    await tx.insert(callCostBreakdown).values({
      callId: existingCall.id,
      ratePerMinUsd: ratePerMinUsd.toString(),
      billedMinutes,
      twilioPriceUsd: twilioPriceUsd.toFixed(6),
      twilioPriceUnit,
      userPriceUsd: chargeAmount.toFixed(6),
      profitMargin: profitMargin.toFixed(4),
      twilioDurationSeconds: durationSeconds,
      pricingSnapshot: {
        ratePerMinUsd,
        durationSeconds,
        billedMinutes,
        twilioPriceUsd,
        twilioPriceUnit,
        userPriceUsd: chargeAmount,
        profitMargin,
        insufficientBalance: true,
        originalUserPrice: userPriceUsd,
      },
    });

    return {
      billed: true,
      userPriceUsd: chargeAmount,
      newBalance,
      durationSeconds,
      billedMinutes,
    };
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
    amountUsd: (-userPriceUsd).toFixed(2),
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
    twilioPriceUnit,
    userPriceUsd: userPriceUsd.toFixed(6),
    profitMargin: profitMargin.toFixed(4),
    twilioDurationSeconds: durationSeconds,
    pricingSnapshot: {
      ratePerMinUsd,
      durationSeconds,
      billedMinutes,
      twilioPriceUsd,
      twilioPriceUnit,
      userPriceUsd,
      profitMargin,
    },
  });

  // Mark call as billed and completed
  await tx
    .update(call)
    .set({
      status: "completed",
      endedAt: existingCall.endedAt || new Date(),
      durationSeconds,
      billedAt: new Date(),
    })
    .where(eq(call.id, existingCall.id));

  return {
    billed: true,
    userPriceUsd,
    newBalance,
    durationSeconds,
    billedMinutes,
  };
}





