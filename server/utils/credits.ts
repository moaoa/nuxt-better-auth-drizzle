/**
 * USD-Based Pricing Utilities
 * All calculations work directly with USD amounts.
 */

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





