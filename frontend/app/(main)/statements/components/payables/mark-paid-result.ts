import type { LateReason } from '@/app/lib/late-reasons-api';
import type {
  AddPayablePaymentInput,
  BookPayablePaymentInput,
  MarkPayablePaidInput,
} from '@/app/lib/payables-api';
import { type AmountState, type CashState, cashSource } from './MarkPaidFields';

export type { CashState };

export type Mode = 'match' | 'cash' | 'plain';

/**
 * Settling in full keeps going through `mark-paid` — it guards against a
 * second payment and notifies the workspace. Anything else is one payment
 * among several.
 */
export type MarkPaidResult = (
  | { kind: 'full'; payload: MarkPayablePaidInput }
  | { kind: 'payment'; payload: AddPayablePaymentInput }
  /** The money of a payment recorded without it: where it went. */
  | { kind: 'book'; paymentId: string; payload: BookPayablePaymentInput }
) & { /** Paid after the due date: why, if the person said. */ lateReason?: LateReason };

export function buildResult(
  mode: Mode,
  selected: {
    transactionId: string | null;
    cash: CashState;
    amount: AmountState;
    outstanding: number;
  },
): MarkPaidResult | null {
  const amount = Math.round(Number(selected.amount.amount) * 100) / 100;
  const fee = Math.round(Number(selected.amount.feeAmount || 0) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > selected.outstanding + 0.005) {
    return null;
  }
  const settlesInFull = amount >= selected.outstanding - 0.005 && fee <= 0;

  if (mode === 'match') {
    if (!selected.transactionId) {
      return null;
    }
    return settlesInFull
      ? { kind: 'full', payload: { linkedTransactionId: selected.transactionId } }
      : {
          kind: 'payment',
          payload: {
            amount,
            feeAmount: fee || undefined,
            linkedTransactionId: selected.transactionId,
          },
        };
  }
  if (mode === 'cash') {
    const { walletId, paidOn, categoryId } = selected.cash;
    if (!walletId) {
      return null;
    }
    const source = cashSource(walletId);
    return settlesInFull
      ? {
          kind: 'full',
          payload: { ...source, paidOn, categoryId: categoryId || undefined },
        }
      : {
          kind: 'payment',
          payload: {
            amount,
            feeAmount: fee || undefined,
            paidOn,
            ...source,
            categoryId: categoryId || undefined,
          },
        };
  }
  return settlesInFull
    ? { kind: 'full', payload: {} }
    : { kind: 'payment', payload: { amount, feeAmount: fee || undefined } };
}

/** For a payment recorded without money: the bank row or the wallet it went into. */
export function buildBooking(
  mode: Mode,
  paymentId: string,
  selected: { transactionId: string | null; cash: CashState },
): MarkPaidResult | null {
  if (mode === 'match') {
    return selected.transactionId
      ? { kind: 'book', paymentId, payload: { linkedTransactionId: selected.transactionId } }
      : null;
  }
  if (mode === 'cash' && selected.cash.walletId) {
    return {
      kind: 'book',
      paymentId,
      payload: {
        ...cashSource(selected.cash.walletId),
        categoryId: selected.cash.categoryId || undefined,
      },
    };
  }
  return null;
}
