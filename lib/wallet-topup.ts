export const ALLOWED_TOPUP_AMOUNTS_USD = [5, 10, 15, 20, 25, 30] as const;

export const MIN_TOPUP_AMOUNT_USD = 1;
export const MAX_TOPUP_AMOUNT_USD = 50;

export function isValidTopupAmount(amountUsd: number): boolean {
  if (!Number.isFinite(amountUsd)) {
    return false;
  }

  if (amountUsd < MIN_TOPUP_AMOUNT_USD || amountUsd > MAX_TOPUP_AMOUNT_USD) {
    return false;
  }

  const amountInCents = amountUsd * 100;
  return Math.abs(amountInCents - Math.round(amountInCents)) < 1e-8;
}
