import type { PayPeriodContext } from '@/app/lib/contracts';
import { periodBounds, periodOf } from '@/app/lib/contracts/workspaces/pay-period';

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * `YYYY-MM` of the month the reader is in, by their own calendar; with the
 * workspace's month rule (`context`), the name of the period today falls in,
 * which under day 25 is already next month's from the 25th on.
 */
export function currentMonthKey(now: Date = new Date(), context?: PayPeriodContext): string {
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return context ? periodOf(context, `${month}-${pad(now.getDate())}`) : month;
}

/**
 * The day a figure for a `YYYY-MM` month is measured on: its last day, or null
 * for the month we are in, which is measured today like everywhere else. With
 * the workspace's month rule, the last day of the period of that name, so the
 * backend, which measures the period a day falls in, lands on that period.
 */
export function monthEndOrToday(
  month: string,
  now: Date = new Date(),
  context?: PayPeriodContext,
): string | null {
  if (month === currentMonthKey(now, context)) {
    return null;
  }
  if (context) {
    return periodBounds(context, month).to;
  }
  const [year, index] = month.split('-').map(Number);
  return `${month}-${pad(new Date(year, index, 0).getDate())}`;
}
