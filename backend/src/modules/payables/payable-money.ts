import type { Payable } from '../../entities/payable.entity';

export const round2 = (value: number): number => Math.round(Number(value) * 100) / 100;

/** What is still owed on a bill: its amount less what its payments brought in. */
export const outstandingOf = (payable: Pick<Payable, 'amount' | 'paidAmount'>): number =>
  round2(Number(payable.amount) - Number(payable.paidAmount ?? 0));
