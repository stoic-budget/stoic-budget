import type { Payable } from '@/app/lib/payables-api';

const pad = (value: number) => String(value).padStart(2, '0');

/** Today on the person's own calendar, as the row's "Overdue" label counts it. */
export const localToday = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/**
 * A bill to pay that was paid after its due date, or is still unpaid past it:
 * the one the "Why was it late?" question is for. Only the facts count, as on
 * the server; a reason left on a bill no longer late can still be taken back.
 * Today is the local day, so the question and the "Overdue" label agree.
 */
export function wasLate(payable: Payable, today = localToday()): boolean {
  if (payable.direction !== 'payable' || !payable.dueDate) return false;
  const due = payable.dueDate.slice(0, 10);
  if (payable.status === 'paid')
    return Boolean(payable.paidAt && payable.paidAt.slice(0, 10) > due);
  if (payable.status === 'archived' || payable.skippedAt) return false;
  return due < today;
}

/** Settled on `paidOn`, after its due date: a bill to pay the payment dialog asks about. */
export function paidLate(payable: Payable, paidOn: string | null | undefined): boolean {
  return Boolean(
    payable.direction === 'payable' &&
      payable.dueDate &&
      paidOn &&
      paidOn.slice(0, 10) > payable.dueDate.slice(0, 10),
  );
}
