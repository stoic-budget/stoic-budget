import type { WalletItem } from '@/app/lib/contracts';

/** The contract's ceiling (`CreditLimit`): what a `decimal(15,2)` column holds. */
const MAX_CREDIT_LIMIT = 10_000_000_000_000;

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Digits with up to two decimals after a point or a comma: nothing else is read as money. */
const PLAIN_AMOUNT = /^\d+([.,]\d{1,2})?$/;

/**
 * The limit as typed in the form: empty means none (null), anything the API
 * would refuse is 'invalid'. The same rules as the contract's `CreditLimit`
 * (above zero, below the ceiling, cents at most), and only plain digits: "5,000",
 * "5.000", "1e3" or "0x1F4" could each mean two things, so the form says so
 * instead of sending a number the person did not type.
 */
export function parseCreditLimit(text: string): number | null | 'invalid' {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  if (!PLAIN_AMOUNT.test(trimmed)) {
    return 'invalid';
  }
  const value = Number(trimmed.replace(',', '.'));
  return value > 0 && value < MAX_CREDIT_LIMIT ? value : 'invalid';
}

export interface CreditLimitState {
  limit: number;
  /** Limit plus balance: above the limit when the card is in credit. */
  available: number;
  /** How much of the limit is owed, 0 to 1, for the bar. */
  usedShare: number;
  /** By how much what is owed passes the limit, or null when it does not. */
  over: number | null;
}

/**
 * What is left on a credit card. A card's balance is below zero while money is
 * owed (what is owed is −balance) and above zero when it was overpaid, so
 * available = limit + balance in both cases. Null when there is nothing to show.
 */
export function creditLimitState(
  account: Pick<WalletItem, 'type' | 'balance' | 'creditLimit'>,
): CreditLimitState | null {
  const limit = Number(account.creditLimit);
  if (account.type !== 'credit_card' || account.creditLimit === null || !(limit > 0)) {
    return null;
  }
  const available = round2(limit + account.balance);
  const owed = Math.max(0, -account.balance);
  return {
    limit,
    available,
    usedShare: Math.min(1, owed / limit),
    over: available < 0 ? -available : null,
  };
}
