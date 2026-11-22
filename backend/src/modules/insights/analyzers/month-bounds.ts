import { monthsBetweenKeys, type PayPeriodContext } from '../../../contracts';
import {
  dayAfterPeriod,
  localMidnight,
  periodBefore,
  periodKeyAt,
} from '../../pay-period/pay-period-dates';

/**
 * Month helpers of the analyzers. Each takes the workspace's month rule as
 * optional (`settings.monthStart`); without one they are calendar months.
 */

/** The month `monthsAgo` months before the one `now` falls in, with its `YYYY-MM` name. */
export function monthBounds(
  now: Date,
  monthsAgo: number,
  payPeriod?: PayPeriodContext | null,
): { start: Date; end: Date; key: string } {
  return periodBefore(payPeriod, now, monthsAgo);
}

/** Months from the one `earlier` falls in to the one `later` falls in. */
export function monthsBetween(
  earlier: Date,
  later: Date,
  payPeriod?: PayPeriodContext | null,
): number {
  return monthsBetweenKeys(periodKeyAt(payPeriod, earlier), periodKeyAt(payPeriod, later));
}

/** Midnight of the day after the month `now` falls in. */
export function endOfMonth(now: Date, payPeriod?: PayPeriodContext | null): Date {
  return dayAfterPeriod(payPeriod, now);
}

/** The `YYYY-MM` name of the month `now` falls in. */
export function monthKey(now: Date, payPeriod?: PayPeriodContext | null): string {
  return periodKeyAt(payPeriod, now);
}

/** A day a query answered: `YYYY-MM-DD` as that local day, a timestamp as it is. */
export function dayOfRow(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? localMidnight(value) : new Date(value);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
