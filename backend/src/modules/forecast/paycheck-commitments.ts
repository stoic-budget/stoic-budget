import type { DashboardCommitmentItem } from '../../contracts';
import { addDays } from './forecast.engine';
import type { PlanCommitment } from './paycheck-planner';

/** Each subscription interval in days, roughly: a payment within half of it belongs to that charge. */
const INTERVAL_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
  annual: 365,
};

export interface SubscriptionPayments {
  /** `YYYY-MM-DD` of the payments recorded for the subscription, newest first. */
  paymentDates: string[];
  frequency: string;
}

/**
 * The dashboard's commitments as planner items, less a subscription charge
 * already paid early: linking a payment made before the next charge date
 * keeps that date (it is the following one only once the day passes), so
 * the first projected charge after a recent payment may be that payment.
 *
 * It is, only when the charge before it was paid too. A payment just before
 * the next date with nothing around the previous one is the previous charge
 * paid late, and the next charge is still owed.
 */
export function toPlanCommitments(
  items: readonly DashboardCommitmentItem[],
  payments: ReadonlyMap<string, SubscriptionPayments>,
  today: string,
): PlanCommitment[] {
  const seen = new Set<string>();
  const result: PlanCommitment[] = [];
  for (const item of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
    if (item.source === 'subscription' && !seen.has(item.sourceId)) {
      seen.add(item.sourceId);
      if (paidEarly(item.date, payments.get(item.sourceId), today)) continue;
    }
    result.push({
      date: item.date,
      label: item.label,
      amount: item.amount,
      kind: item.source,
      sourceId: item.sourceId,
      isOverdue: item.isOverdue,
    });
  }
  return result;
}

function paidEarly(
  date: string,
  payments: SubscriptionPayments | undefined,
  today: string,
): boolean {
  if (!payments) return false;
  const interval = INTERVAL_DAYS[payments.frequency] ?? INTERVAL_DAYS.monthly;
  const half = Math.floor(interval / 2);
  const [latest, ...earlier] = payments.paymentDates.filter(day => day <= today);
  if (!latest || latest <= addDays(date, -half)) return false;
  const previousCharge = addDays(date, -interval);
  return earlier.some(day => day > addDays(previousCharge, -half));
}
