import type { Payable } from '../../entities/payable.entity';

export const round2 = (value: number): number => Math.round(Number(value) * 100) / 100;

/** What is still owed on a bill: its amount less what its payments brought in. */
export const outstandingOf = (payable: Pick<Payable, 'amount' | 'paidAmount'>): number =>
  round2(Number(payable.amount) - Number(payable.paidAmount ?? 0));

/** Midnight UTC of the day. */
export const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

/** `YYYY-MM-DD` of a date column or a `Date`. */
export const toDateString = (value: Date | string): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
