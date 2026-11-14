import type { RecurrenceRule, RecurrenceShift } from '../../contracts';
import { addDays, daysBetween, daysInMonth, formatDay, isWeekend, parseDay } from './date-only';

export type { RecurrenceRule };

/** Bounds a walk over a corrupt rule; a daily rule reaches it after ~270 years. */
const MAX_STEPS = 100_000;

/** The day a monthly or yearly occurrence falls on in this month. */
function dayInMonth(rule: RecurrenceRule, year: number, month: number): number {
  const length = daysInMonth(year, month);
  if (rule.nthWeekday) {
    const { week, weekday } = rule.nthWeekday;
    if (week === -1) {
      const lastWeekday = new Date(Date.UTC(year, month, length)).getUTCDay();
      return length - ((lastWeekday - weekday + 7) % 7);
    }
    const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    return 1 + ((weekday - firstWeekday + 7) % 7) + (week - 1) * 7;
  }
  if (rule.monthDay === 'last') return length;
  const wanted = rule.monthDay ?? parseDay(rule.startDate).getUTCDate();
  return Math.min(wanted, length);
}

/**
 * The k-th date of the rule's grid, by index rather than by stepping from the
 * previous one, so a clamped month never becomes the anchor of the next. The
 * grid may put k = 0 before the start date (a monthly rule on the 1st that
 * starts on the 20th); such a date is not an occurrence.
 */
export function gridDate(rule: RecurrenceRule, k: number): string {
  const step = rule.interval * k;
  switch (rule.frequency) {
    case 'daily':
      return addDays(rule.startDate, step);
    case 'weekly':
      return addDays(rule.startDate, 7 * step);
    case 'monthly':
    case 'yearly': {
      const start = parseDay(rule.startDate);
      const months = rule.frequency === 'monthly' ? step : 12 * step;
      const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
      const year = first.getUTCFullYear();
      const month = first.getUTCMonth();
      return formatDay(new Date(Date.UTC(year, month, dayInMonth(rule, year, month))));
    }
  }
}

/** A grid index at or before the first occurrence after `day`: where a walk may start. */
function indexNear(rule: RecurrenceRule, day: string): number {
  const days = daysBetween(rule.startDate, day);
  if (days <= 0) return 0;
  const start = parseDay(rule.startDate);
  const at = parseDay(day);
  const months =
    (at.getUTCFullYear() - start.getUTCFullYear()) * 12 + at.getUTCMonth() - start.getUTCMonth();
  const units = {
    daily: days,
    weekly: Math.floor(days / 7),
    monthly: months,
    yearly: Math.floor(months / 12),
  }[rule.frequency];
  return Math.max(0, Math.floor(units / rule.interval) - 1);
}

/**
 * The occurrences of the rule from `from` on, both before shifting off
 * non-working days, in order, until the rule ends (`until`, `count`) or the
 * caller stops asking.
 */
export function* occurrencesFrom(rule: RecurrenceRule, from: string): Generator<string> {
  // k = 0 lies before the start only when the rule names another day.
  const skipsFirst = gridDate(rule, 0) < rule.startDate;
  const firstIndex = skipsFirst ? 1 : 0;
  const lastIndex = rule.count ? firstIndex + rule.count - 1 : Number.POSITIVE_INFINITY;
  let k = Math.max(firstIndex, indexNear(rule, from));
  for (let steps = 0; steps < MAX_STEPS && k <= lastIndex; steps += 1, k += 1) {
    const date = gridDate(rule, k);
    if (rule.until && date > rule.until) return;
    if (date >= from) yield date;
  }
}

/** The first occurrence strictly after `after`, or null once the rule has ended. */
export function nextOccurrence(rule: RecurrenceRule, after: string): string | null {
  const next = occurrencesFrom(rule, addDays(after, 1)).next();
  return next.done ? null : next.value;
}

/** The first occurrence on or after the start date, or null for a rule that never fires. */
export function firstOccurrence(rule: RecurrenceRule): string | null {
  const first = occurrencesFrom(rule, rule.startDate).next();
  return first.done ? null : first.value;
}

/** Occurrences between two days, both included, at most `limit` of them. */
export function occurrencesBetween(
  rule: RecurrenceRule,
  from: string,
  to: string,
  limit = 1000,
): string[] {
  const dates: string[] = [];
  for (const date of occurrencesFrom(rule, from)) {
    if (date > to || dates.length >= limit) break;
    dates.push(date);
  }
  return dates;
}

/**
 * The day an occurrence is actually due: moved off a weekend or a day in
 * `holidays` (`YYYY-MM-DD`) to the working day before or after it. The
 * holidays come from the caller, so this stays a pure function.
 */
export function shiftOffNonWorkingDays(
  day: string,
  shift: RecurrenceShift | undefined,
  holidays: ReadonlySet<string> = new Set(),
): string {
  if (!shift || shift === 'none') return day;
  const direction = shift === 'previous' ? -1 : 1;
  let cursor = day;
  // Two weeks of holidays in a row would be a broken calendar; stop there.
  for (let steps = 0; steps < 14 && (isWeekend(cursor) || holidays.has(cursor)); steps += 1) {
    cursor = addDays(cursor, direction);
  }
  return cursor;
}

/** The monthly rule an old "recurring" flag stood for: every month on the due date's day. */
export function monthlyRuleFrom(startDate: string): RecurrenceRule {
  return { frequency: 'monthly', interval: 1, startDate };
}

/** The years an occurrence between two days can fall in, for a holiday lookup. */
export function yearsBetween(from: string, to: string): number[] {
  const first = Number(from.slice(0, 4));
  const last = Number(to.slice(0, 4));
  return Array.from({ length: Math.max(0, last - first) + 1 }, (_, index) => first + index);
}
