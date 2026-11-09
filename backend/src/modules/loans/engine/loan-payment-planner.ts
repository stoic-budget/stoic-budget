import { fromMinor, toMinor } from '../../../common/utils/money.util';
import type { ScheduleRow } from './loan-plan';

/** A payment matches a scheduled one at most this many days before or after it. */
export const MATCH_WINDOW_DAYS = 15;
const DAY_MS = 86_400_000;

/** A payment into the loan account, as the planner reads it (major units). */
export interface PlannerPayment {
  id: string;
  date: string;
  amount: number;
  currency: string;
}

export interface PaymentSuggestion {
  /** The schedule period the payment was matched to; null for an extra payment. */
  period: number | null;
  /** What that period asked for (payment plus a planned extra); null for an extra payment. */
  scheduledPayment: number | null;
  interest: number;
  principal: number;
}

/** Why a payment cannot be split by the schedule. */
export type PaymentBlock = 'other_currency' | 'before_start';

export type PaymentPlan =
  | { suggestion: PaymentSuggestion; blocked: null }
  | { suggestion: null; blocked: PaymentBlock };

const daysApart = (left: string, right: string) =>
  Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / DAY_MS;

const sameCurrency = (left: string, right: string) =>
  left.trim().toUpperCase() === right.trim().toUpperCase();

/**
 * How each payment divides into interest and principal by the schedule.
 *
 * Every scheduled period takes at most one payment: among those within
 * `MATCH_WINDOW_DAYS` of its date, the one closest to what the period asked
 * for, then the closest in date. Its interest is the period's, never more than
 * the payment; whatever is paid beyond it goes to principal, so a larger
 * payment pays the debt down faster and an interest-only loan's regular
 * payment is all interest. A payment no period took (a second payment in the
 * month, a lump sum) is all principal. A payment in another currency, or made
 * before the loan starts, is not divided at all.
 */
export function planPayments(
  schedule: ReadonlyArray<Pick<ScheduleRow, 'period' | 'date' | 'payment' | 'interest' | 'extra'>>,
  payments: ReadonlyArray<PlannerPayment>,
  loan: { currency: string; startDate: string },
): Map<string, PaymentPlan> {
  const plans = new Map<string, PaymentPlan>();
  const open: PlannerPayment[] = [];
  for (const payment of payments) {
    if (!sameCurrency(payment.currency, loan.currency)) {
      plans.set(payment.id, { suggestion: null, blocked: 'other_currency' });
    } else if (payment.date < loan.startDate) {
      plans.set(payment.id, { suggestion: null, blocked: 'before_start' });
    } else {
      open.push(payment);
    }
  }

  const matched = new Map<string, (typeof schedule)[number]>();
  for (const row of schedule) {
    const asked = toMinor(row.payment + row.extra);
    const best = open
      .filter(payment => !matched.has(payment.id))
      .filter(payment => daysApart(payment.date, row.date) <= MATCH_WINDOW_DAYS)
      .map(payment => ({
        payment,
        off: Math.abs(toMinor(payment.amount) - asked),
        apart: daysApart(payment.date, row.date),
      }))
      .sort(
        (left, right) =>
          left.off - right.off ||
          left.apart - right.apart ||
          left.payment.date.localeCompare(right.payment.date) ||
          left.payment.id.localeCompare(right.payment.id),
      )[0];
    if (best) {
      matched.set(best.payment.id, row);
    }
  }

  for (const payment of open) {
    const row = matched.get(payment.id);
    const amount = toMinor(payment.amount);
    const interest = row ? Math.min(toMinor(row.interest), amount) : 0;
    plans.set(payment.id, {
      blocked: null,
      suggestion: {
        period: row?.period ?? null,
        scheduledPayment: row ? fromMinor(toMinor(row.payment + row.extra)) : null,
        interest: fromMinor(interest),
        principal: fromMinor(amount - interest),
      },
    });
  }
  return plans;
}
