import type { PayPeriodContext } from '../../contracts';
import { isCalendar, periodRangeAt, periodRangeOfKey } from '../pay-period/pay-period-dates';

export interface DashboardWindow {
  since: Date;
  endDate: Date;
}

/** A rolling window of `days` days ending at `targetDate` (inclusive, end of day). */
export function getWindowBounds(days: number, targetDate: Date): DashboardWindow {
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  const since = new Date(endDate);
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  return { since, endDate };
}

/** A month's first day at 00:00:00 to its last day at 23:59:59.999. */
function wholeDays(range: { start: Date; end: Date }): DashboardWindow {
  const endDate = new Date(range.end);
  endDate.setHours(23, 59, 59, 999);
  return { since: new Date(range.start), endDate };
}

/**
 * The month containing `anchorDate`, from its first day 00:00:00 to its last day 23:59:59.999:
 * the calendar month, or the workspace's month when `payPeriod` starts it on another day. With
 * `byName`, the month named after `anchorDate`'s calendar month (a picked month arrives as its
 * first day, which a month starting on the 15th does not contain).
 */
export function getMonthWindowBounds(
  anchorDate: Date,
  payPeriod?: PayPeriodContext | null,
  byName = false,
): DashboardWindow {
  if (!isCalendar(payPeriod)) {
    const key = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, '0')}`;
    return wholeDays(
      byName ? periodRangeOfKey(payPeriod, key) : periodRangeAt(payPeriod, anchorDate),
    );
  }
  const since = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 0, 0, 0, 0);
  const endDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 23, 59, 59, 999);
  return { since, endDate };
}

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `YYYY-MM` → the window of the month it names; anything else (including `undefined`) → `null`. */
export function parseMonthWindow(
  month: string | undefined,
  payPeriod?: PayPeriodContext | null,
): DashboardWindow | null {
  const match = month ? MONTH_PARAM.exec(month) : null;
  const anchor = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : null;
  return anchor ? getMonthWindowBounds(anchor, payPeriod, true) : null;
}

/**
 * The dashboard's window ending at `anchor`: its month in month mode (see getMonthWindowBounds),
 * else the `days` days up to it.
 */
export function dashboardWindow(
  isMonth: boolean,
  days: number,
  anchor: Date,
  payPeriod?: PayPeriodContext | null,
  byName = false,
): DashboardWindow {
  return isMonth ? getMonthWindowBounds(anchor, payPeriod, byName) : getWindowBounds(days, anchor);
}

export const CASH_FLOW_RANGES = ['12m', 'this_year', '5y', 'all'] as const;

export type CashFlowRange = (typeof CASH_FLOW_RANGES)[number];

/** Months before the current one that a fixed-length range reaches back. */
const CASH_FLOW_MONTHS_BACK: Record<'12m' | '5y', number> = { '12m': 11, '5y': 59 };

/**
 * Whole calendar months ending with the month containing `anchor` (the dashboard's picked month,
 * or today). `this_year` is the anchor's year up to the anchor month. `all` starts at the month of
 * `earliest` and is `null` when there are no transactions up to the anchor month.
 */
export function getCashFlowRangeBounds(
  range: CashFlowRange,
  anchor: Date,
  earliest: Date | null,
): DashboardWindow | null {
  const endDate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
  let since: Date;
  if (range === 'all') {
    if (!earliest || earliest > endDate) {
      return null;
    }
    since = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  } else if (range === 'this_year') {
    since = new Date(anchor.getFullYear(), 0, 1);
  } else {
    since = new Date(anchor.getFullYear(), anchor.getMonth() - CASH_FLOW_MONTHS_BACK[range], 1);
  }
  return { since, endDate };
}

/** Number of days a window covers, both ends included. */
export function daysInWindow(window: DashboardWindow): number {
  const first = new Date(
    window.since.getFullYear(),
    window.since.getMonth(),
    window.since.getDate(),
  );
  const last = new Date(
    window.endDate.getFullYear(),
    window.endDate.getMonth(),
    window.endDate.getDate(),
  );
  return Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
}

/** Number of days in the calendar month containing `anchorDate`. */
export function daysInMonth(anchorDate: Date): number {
  return new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0).getDate();
}
