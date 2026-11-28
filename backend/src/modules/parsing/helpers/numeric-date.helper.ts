import type { DateOrder } from '../parsers/csv-presets';

/**
 * Numeric dates of a table export (01/05/2026, 13.01.26, 2026/01/15 is read
 * elsewhere): the day/month order is a property of the file, decided once
 * from every date in its column, so one row cannot be read day-first and the
 * next month-first (#674). Used by the CSV and Excel parsers.
 */
const NUMERIC_DATE =
  /^(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * 'mdy' when some date only makes sense month-first (01/13/2026), 'dmy' when
 * some date only makes sense day-first (13/01/2026), null when every date in
 * the file reads both ways.
 */
export function detectDateOrder(values: string[]): DateOrder | null {
  for (const value of values) {
    const match = value.trim().match(NUMERIC_DATE);
    if (!match) {
      continue;
    }
    const [first, second] = [Number(match[1]), Number(match[2])];
    if (first > 12 && second <= 12) {
      return 'dmy';
    }
    if (second > 12 && first <= 12) {
      return 'mdy';
    }
  }
  return null;
}

export function parseNumericDate(value: string, order: DateOrder): Date | null {
  const match = value.trim().match(NUMERIC_DATE);
  if (!match) {
    return null;
  }
  const [, a, b, y, hours = '0', minutes = '0', seconds = '0'] = match;
  const [day, month] = order === 'mdy' ? [Number(b), Number(a)] : [Number(a), Number(b)];
  const year = y.length === 2 ? (Number(y) <= 49 ? 2000 : 1900) + Number(y) : Number(y);
  const date = new Date(year, month - 1, day, Number(hours), Number(minutes), Number(seconds));
  // Reject rollovers such as 31/02 becoming March 3rd.
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
