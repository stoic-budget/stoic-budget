import type { PayPeriodContext } from '../../contracts';
import { BudgetPeriodType } from '../../entities/budget.entity';
import {
  isCalendar,
  periodKeyAt,
  periodRangeAt,
  periodRangeOfKey,
} from '../pay-period/pay-period-dates';

/**
 * A budget's own window: the period of its type that contains `date`.
 *
 * Extracted from BudgetsService so the plan-versus-actual aggregate resolves
 * windows exactly the way the budgets page does, rather than growing a second
 * definition of "this period" that drifts from it.
 *
 * A monthly budget runs over the workspace's own month when `payPeriod` sets
 * one (`settings.monthStart`); weeks, quarters and years stay on the calendar.
 */
export function computePeriodRange(
  periodType: BudgetPeriodType,
  date: Date,
  payPeriod?: PayPeriodContext | null,
): { start: Date; end: Date } {
  const d = new Date(date);
  if (periodType === BudgetPeriodType.MONTHLY && !isCalendar(payPeriod)) {
    return periodRangeAt(payPeriod, d);
  }

  switch (periodType) {
    case BudgetPeriodType.WEEKLY: {
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1; // Monday = 0
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { start, end };
    }
    case BudgetPeriodType.MONTHLY: {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start, end };
    }
    case BudgetPeriodType.QUARTERLY: {
      const quarter = Math.floor(d.getMonth() / 3);
      const start = new Date(d.getFullYear(), quarter * 3, 1);
      const end = new Date(d.getFullYear(), quarter * 3 + 3, 0);
      return { start, end };
    }
    case BudgetPeriodType.ANNUAL: {
      const start = new Date(d.getFullYear(), 0, 1);
      const end = new Date(d.getFullYear(), 11, 31);
      return { start, end };
    }
  }
}

/**
 * A budget's limit expressed per month.
 *
 * A goal can bundle a weekly grocery limit with an annual insurance one, and
 * summing those raw would compare a week against a year. The flow view puts
 * every budget on one monthly axis; the untouched limit and its period type
 * travel alongside so the client can still show what was actually declared.
 *
 * Weeks use 52/12 rather than 4, because twelve four-week months are only 336
 * days and would understate a weekly limit by roughly 8%.
 */
export function normalizeLimitToMonth(limitAmount: number, periodType: BudgetPeriodType): number {
  switch (periodType) {
    case BudgetPeriodType.WEEKLY:
      return (limitAmount * 52) / 12;
    case BudgetPeriodType.MONTHLY:
      return limitAmount;
    case BudgetPeriodType.QUARTERLY:
      return limitAmount / 3;
    case BudgetPeriodType.ANNUAL:
      return limitAmount / 12;
  }
}

/** First and last day of the month `anchor` falls in: the workspace's month when one is given. */
export function computeMonthRange(
  anchor: Date,
  payPeriod?: PayPeriodContext | null,
): { start: Date; end: Date } {
  if (!isCalendar(payPeriod)) {
    return periodRangeAt(payPeriod, anchor);
  }
  return {
    start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
    end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
  };
}

/**
 * Parses a `YYYY-MM` month key into a date inside that month, falling back to
 * `fallback` when the key is absent. The DTO already rejects malformed keys;
 * this only has to handle the absent case.
 */
export function parseMonthKey(month: string | undefined, fallback: Date): Date {
  if (!month) {
    return fallback;
  }
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1);
}

/**
 * The month a `YYYY-MM` key names, or the month `now` falls in without one:
 * its name, its range, and the day the budgets' own periods are read at (the
 * first day for a named month, `now` otherwise). A key is a period's name,
 * not a day: with a month starting on the 25th, "2026-11" is 25 Oct – 24 Nov,
 * which the first of November does not even fall in.
 */
export function resolveMonth(
  month: string | undefined,
  now: Date,
  payPeriod?: PayPeriodContext | null,
): { key: string; anchor: Date; window: { start: Date; end: Date } } {
  if (!month) {
    return {
      key: periodKeyAt(payPeriod, now),
      anchor: now,
      window: computeMonthRange(now, payPeriod),
    };
  }
  const window = periodRangeOfKey(payPeriod, month);
  return { key: month, anchor: window.start, window };
}

/** Formats a date as the `YYYY-MM` key the flow endpoint echoes back. */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The lifetime a budget declares. Both null means "runs forever". */
export interface BudgetWindow {
  startsOn: string | null;
  endsOn: string | null;
}

/**
 * Parses a `YYYY-MM-DD` column into a local midnight Date.
 *
 * `new Date('2026-02-01')` is parsed as UTC, which lands on January 31 for
 * anyone west of Greenwich — every other range in this file is built from local
 * date parts, so the two would be off by a day against each other.
 */
export function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * Narrows a period to the part of it the budget actually governs, or null when
 * the two do not overlap at all.
 *
 * A budget that starts on the 10th should not be charged for the 1st to the
 * 9th, and one that ended in August should report nothing for September rather
 * than reporting the month's full spending against a limit that no longer
 * applies.
 */
export function clampToWindow(
  range: { start: Date; end: Date },
  window: BudgetWindow,
): { start: Date; end: Date } | null {
  const start = window.startsOn
    ? new Date(Math.max(range.start.getTime(), parseDateOnly(window.startsOn).getTime()))
    : range.start;
  const end = window.endsOn
    ? new Date(Math.min(range.end.getTime(), parseDateOnly(window.endsOn).getTime()))
    : range.end;

  return start.getTime() > end.getTime() ? null : { start, end };
}

/** Whether the budget governs any part of `range`. */
export function overlapsWindow(range: { start: Date; end: Date }, window: BudgetWindow): boolean {
  return clampToWindow(range, window) !== null;
}

/**
 * The budget's periods before the one starting on `currentStart`, oldest
 * first: at most `lookback` of them, back to the period `began` falls in, each
 * narrowed to the budget's window (one it does not govern at all is skipped).
 */
export function previousPeriods(
  budget: BudgetWindow & { periodType: BudgetPeriodType },
  currentStart: Date,
  began: Date,
  lookback: number,
  payPeriod?: PayPeriodContext | null,
): Array<{ start: Date; end: Date }> {
  const periods: Array<{ start: Date; end: Date }> = [];
  const dayBefore = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);
  let cursor = dayBefore(currentStart);
  while (periods.length < lookback) {
    const range = computePeriodRange(budget.periodType, cursor, payPeriod);
    if (range.end.getTime() < began.getTime()) break;
    const clamped = clampToWindow(range, budget);
    if (clamped) periods.unshift(clamped);
    cursor = dayBefore(range.start);
  }
  return periods;
}

/** A day in local time, as a `date` column stores it. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}
