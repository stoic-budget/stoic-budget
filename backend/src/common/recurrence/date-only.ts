/**
 * Calendar-day arithmetic on `YYYY-MM-DD` strings. Every step goes through
 * UTC midnight, so no time zone or daylight-saving change can move a day.
 */

const DAY_MS = 86_400_000;

export function parseDay(day: string): Date {
  return new Date(`${day.slice(0, 10)}T00:00:00.000Z`);
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The calendar day a local `Date` falls on, as the people looking at it see it. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** A `date` column arrives as `YYYY-MM-DD`; a `Date` here is the UTC day it was written as. */
export function toDay(value: Date | string): string {
  return typeof value === 'string' ? value.slice(0, 10) : formatDay(value);
}

/** `monthIndex` is 0-based; any integer, it rolls into other years. */
export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addDays(day: string, days: number): string {
  return formatDay(new Date(parseDay(day).getTime() + days * DAY_MS));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);
}

/**
 * `months` after `day`, on `anchorDay` (the day of `day` when left out),
 * clamped to the length of the target month: 31 January plus one month is
 * 28 or 29 February, never 3 March, and the anchor is re-applied every time so
 * a clamped February does not drag March back to the 28th.
 */
export function addMonthsClamped(day: string, months: number, anchorDay?: number): string {
  const date = parseDay(day);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth();
  const wanted = anchorDay ?? date.getUTCDate();
  return formatDay(new Date(Date.UTC(year, month, Math.min(wanted, daysInMonth(year, month)))));
}

/** 0 is Sunday. */
export function weekdayOf(day: string): number {
  return parseDay(day).getUTCDay();
}

export function isWeekend(day: string): boolean {
  const weekday = weekdayOf(day);
  return weekday === 0 || weekday === 6;
}
