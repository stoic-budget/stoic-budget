import type { LoanPaymentItem } from '@/app/lib/contracts';
import { parseNumber } from './loan-form';

/** The typed interest, when it is a cent or more, in cents, and at most the payment; else null. */
export function interestFrom(typed: string, payment: number): number | null {
  const value = parseNumber(typed);
  if (value === null || Math.abs(Math.round(value * 100) - value * 100) > 1e-6) {
    return null;
  }
  const cents = Math.round(value * 100);
  return cents >= 1 && cents <= Math.round(payment * 100) ? cents / 100 : null;
}

/** What a payment row says under its amount. */
export type PaymentState =
  | { kind: 'split'; interest: number; principal: number }
  | { kind: 'blocked'; reason: NonNullable<LoanPaymentItem['blocked']> }
  | { kind: 'suggested'; interest: number; principal: number }
  | { kind: 'extra' };

export function paymentState(item: LoanPaymentItem): PaymentState {
  if (item.split) {
    return { kind: 'split', interest: item.split.interest, principal: item.split.principal };
  }
  if (item.blocked) {
    return { kind: 'blocked', reason: item.blocked };
  }
  if (item.suggestion && item.suggestion.interest > 0) {
    return {
      kind: 'suggested',
      interest: item.suggestion.interest,
      principal: item.suggestion.principal,
    };
  }
  return { kind: 'extra' };
}
