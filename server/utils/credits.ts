/**
 * Credit System Utilities
 * 
 * Credit Model: 1 credit = $0.01 USD
 * All conversions and calculations follow this model.
 */

const CREDIT_USD_RATE = 0.01; // 1 credit = $0.01

/**
 * Convert USD to credits
 * @param usd - Amount in USD
 * @returns Number of credits (rounded to nearest integer)
 */
export function usdToCredits(usd: number): number {
  if (usd < 0) {
    throw new Error("USD amount cannot be negative");
  }
  return Math.round(usd / CREDIT_USD_RATE);
}

/**
 * Convert credits to USD
 * @param credits - Number of credits
 * @returns Amount in USD
 */
export function creditsToUsd(credits: number): number {
  return credits * CREDIT_USD_RATE;
}

/**
 * Calculate credits charged for a call
 * Rounds up per minute (minimum 1 minute charge)
 * 
 * @param ratePerMinUsd - Rate per minute in USD
 * @param durationSeconds - Call duration in seconds
 * @returns Credits charged (always rounds up to nearest minute)
 */
export function calculateCallCredits(
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
  const totalUsd = ratePerMinUsd * minutes;
  return usdToCredits(totalUsd);
}

/**
 * Calculate maximum allowed seconds for a call based on balance
 * 
 * @param balanceCredits - Current credit balance
 * @param ratePerMinUsd - Rate per minute in USD
 * @returns Maximum seconds allowed (0 if insufficient balance)
 */
export function calculateMaxAllowedSeconds(
  balanceCredits: number,
  ratePerMinUsd: number
): number {
  if (balanceCredits < 0) {
    return 0;
  }
  if (ratePerMinUsd <= 0) {
    return 0;
  }

  const creditsPerMinute = usdToCredits(ratePerMinUsd);
  if (creditsPerMinute === 0) {
    return 0;
  }

  // Calculate how many minutes we can afford
  const affordableMinutes = Math.floor(balanceCredits / creditsPerMinute);
  return affordableMinutes * 60;
}





