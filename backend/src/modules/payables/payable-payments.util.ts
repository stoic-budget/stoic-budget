import { BadRequestException } from '@nestjs/common';
import { appError } from '../../common/errors/app-error';

/** The money came one way: a bank row, a wallet, or cash in hand — never two at once. */
export function assertOneSource(source: {
  linkedTransactionId?: string | null;
  payFromWalletId?: string | null;
  inHand?: boolean | null;
}): void {
  const sources = [source.linkedTransactionId, source.payFromWalletId, source.inHand].filter(
    Boolean,
  );
  if (sources.length > 1) {
    throw new BadRequestException(appError('PAYABLE_PAYMENT_AMBIGUOUS'));
  }
}

/**
 * The smallest set of bills that adds up to the amount, by index.
 *
 * Exhaustive over at most 2^12 combinations — the pool is capped, so this
 * stays a few thousand additions rather than a search problem.
 */
export function exactSubset(amounts: number[], target: number): number[] | null {
  let best: number[] | null = null;
  for (let mask = 1; mask < 1 << amounts.length; mask++) {
    const picked: number[] = [];
    let sum = 0;
    for (let index = 0; index < amounts.length; index++) {
      if (mask & (1 << index)) {
        picked.push(index);
        sum += amounts[index];
      }
    }
    if (Math.abs(sum - target) <= 0.01 && (!best || picked.length < best.length)) {
      best = picked;
    }
  }
  return best;
}

/** SQL: the bank row was not refused ("not this payment") as the payment of the bill. */
export function notRejectedSql(payableId: string, transactionId: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM "payable_match_rejections" rejected
     WHERE rejected."payable_id" = ${payableId} AND rejected."transaction_id" = ${transactionId})`;
}
