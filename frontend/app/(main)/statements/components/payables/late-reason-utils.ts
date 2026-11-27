import type { Payable } from '@/app/lib/payables-api';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * A bill to pay that was paid after its due date, or is still unpaid past it:
 * the one the "Why was it late?" question is for. A reason already given keeps
 * it so, and the server checks the same with the payments' own days.
 */
export function wasLate(payable: Payable, today = todayIso()): boolean {
  if (payable.direction !== 'payable' || !payable.dueDate) return false;
  if (payable.lateReason) return true;
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
