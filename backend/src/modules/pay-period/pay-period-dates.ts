import {
  addDays,
  isCalendarMonth,
  type PayPeriodContext,
  periodBounds,
  periodOf,
  shiftMonth,
} from '../../contracts';

/**
 * The workspace month (see `contracts/workspaces/pay-period.ts`) as the local
 * `Date` ranges the services already work with: `start` at local midnight of
 * the first day, `end` at local midnight of the last, like `computeMonthRange`.
 *
 * Every helper takes the context as optional: without one it is the calendar
 * month, so callers that are not given a workspace's rule behave as before.
 */
export type DateRange = { start: Date; end: Date };

/** A `YYYY-MM-DD` day as local midnight. */
export function localMidnight(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/** A Date's local day, `YYYY-MM-DD`. */
export function dayKey(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const CALENDAR: PayPeriodContext = { monthStart: { kind: 'day', day: 1 } };

/** The context to work with: the calendar month when none is given. */
export const orCalendar = (context?: PayPeriodContext | null): PayPeriodContext =>
  context ?? CALENDAR;

/** Whether the context changes nothing: no rule, or day 1. */
export const isCalendar = (context?: PayPeriodContext | null): boolean =>
  !context || isCalendarMonth(context);

/** The period named `monthKey` (`YYYY-MM`) as local dates. */
export function periodRangeOfKey(
  context: PayPeriodContext | null | undefined,
  monthKey: string,
): DateRange {
  const bounds = periodBounds(orCalendar(context), monthKey);
  return { start: localMidnight(bounds.from), end: localMidnight(bounds.to) };
}

/** The period named `monthKey` as days: `from` its first, `until` the day after its last. */
export function periodDaysOfKey(
  context: PayPeriodContext | null | undefined,
  monthKey: string,
): { from: string; until: string } {
  const bounds = periodBounds(orCalendar(context), monthKey);
  return { from: bounds.from, until: addDays(bounds.to, 1) };
}

/** The `YYYY-MM` name of the period the local day of `date` falls in. */
export function periodKeyAt(context: PayPeriodContext | null | undefined, date: Date): string {
  return periodOf(orCalendar(context), dayKey(date));
}

/** The period the local day of `date` falls in, as local dates. */
export function periodRangeAt(context: PayPeriodContext | null | undefined, date: Date): DateRange {
  return periodRangeOfKey(context, periodKeyAt(context, date));
}

/** The period `monthsAgo` periods before the one `date` falls in, with its name. */
export function periodBefore(
  context: PayPeriodContext | null | undefined,
  date: Date,
  monthsAgo: number,
): DateRange & { key: string } {
  const key = shiftMonth(periodKeyAt(context, date), -monthsAgo);
  return { key, ...periodRangeOfKey(context, key) };
}

/** The day after the period `date` falls in, at local midnight. */
export function dayAfterPeriod(context: PayPeriodContext | null | undefined, date: Date): Date {
  const bounds = periodBounds(orCalendar(context), periodKeyAt(context, date));
  return localMidnight(addDays(bounds.to, 1));
}
