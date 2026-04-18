export const ALLOWED_TOPUP_AMOUNTS_USD = [5, 10, 15, 20, 25, 30] as const;

export type AllowedTopupAmountUsd = (typeof ALLOWED_TOPUP_AMOUNTS_USD)[number];

export function isAllowedTopupAmount(amountUsd: number): amountUsd is AllowedTopupAmountUsd {
  return ALLOWED_TOPUP_AMOUNTS_USD.includes(amountUsd as AllowedTopupAmountUsd);
}
