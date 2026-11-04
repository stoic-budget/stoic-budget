import { findFullDates, type NumericDateOrder } from './statement-date.helper';
import { findStatementPeriod } from './statement-metadata.helper';

const DAY_RANGE = /\b(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * A period printed as a day range in one month ("01 -30 Sep 2022"). Only the
 * first such range in the text counts. Null when there is none, the days run
 * backwards, the month is not an English one, or a day is not in that month.
 */
export function findDayRangePeriod(text: string): { from: Date; to: Date } | null {
  const match = DAY_RANGE.exec(text);
  if (!match) {
    return null;
  }
  const month = MONTHS.indexOf(match[3].slice(0, 3).toLowerCase());
  const [fromDay, toDay, year] = [Number(match[1]), Number(match[2]), Number(match[4])];
  if (month < 0 || fromDay > toDay) {
    return null;
  }
  const from = new Date(Date.UTC(year, month, fromDay));
  const to = new Date(Date.UTC(year, month, toDay));
  return from.getUTCMonth() === month && to.getUTCMonth() === month ? { from, to } : null;
}

const MONTH_PERIOD = /\bFor month:?\s+([A-Za-z]{3,9})\s+(\d{4})\b/i;

/**
 * A period printed as a whole month ("For month October 2021"). Only the first
 * such line counts. Null when there is none or the month is not an English one.
 */
export function findMonthPeriod(text: string): { from: Date; to: Date } | null {
  const match = MONTH_PERIOD.exec(text);
  return match ? wholeMonth(match[1], Number(match[2])) : null;
}

/** The first to the last day of an English month ("October", "Oct"), null for any other word. */
export function wholeMonth(name: string, year: number): { from: Date; to: Date } | null {
  const month = MONTHS.indexOf(name.slice(0, 3).toLowerCase());
  return month < 0
    ? null
    : { from: new Date(Date.UTC(year, month, 1)), to: new Date(Date.UTC(year, month + 1, 0)) };
}

const SHARED_YEAR_RANGE =
  /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*(?:[-–—]|to)\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{1,2}),?\s+(\d{4})\b/;

/**
 * A period whose two ends share the year printed once at the end: "Jul 1 -
 * Jul 31, 2023", "Jul 1 - 31, 2023", "Dec 1 to Dec 31, 2017". A range that crosses New Year ("Dec 15 -
 * Jan 14, 2024") starts the year before. Null when there is none, a month is
 * not an English one, or a day is not in its month.
 */
export function findSharedYearPeriod(text: string): { from: Date; to: Date } | null {
  const match = SHARED_YEAR_RANGE.exec(text);
  if (!match) {
    return null;
  }
  const monthOf = (name: string) => MONTHS.indexOf(name.slice(0, 3).toLowerCase());
  const fromMonth = monthOf(match[1]);
  const toMonth = match[3] ? monthOf(match[3]) : fromMonth;
  const [fromDay, toDay, year] = [Number(match[2]), Number(match[4]), Number(match[5])];
  if (fromMonth < 0 || toMonth < 0) {
    return null;
  }
  const from = new Date(Date.UTC(fromMonth > toMonth ? year - 1 : year, fromMonth, fromDay));
  const to = new Date(Date.UTC(year, toMonth, toDay));
  const real = from.getUTCMonth() === fromMonth && to.getUTCMonth() === toMonth;
  return real && from <= to ? { from, to } : null;
}

const FROM_LABEL = /\bf\s?rom\s+date\s*:?/i;
const TO_LABEL = /\bto\s+date\s*:?/i;

/**
 * A period printed as two labelled dates that other text may sit between:
 * "From Date: 10/01/2020" and, a line further, "To Date: 09/02/2020". Each
 * takes the first date after its label. Null when a label or its date is
 * missing or the dates run backwards.
 */
export function findLabelledPeriod(
  text: string,
  order: NumericDateOrder,
): { from: Date; to: Date } | null {
  const dates = findFullDates(text, order);
  const after = (label: RegExp) => {
    const match = label.exec(text);
    const end = match ? match.index + match[0].length : -1;
    return end < 0 ? undefined : dates.find(found => found.index >= end)?.date;
  };
  const [from, to] = [after(FROM_LABEL), after(TO_LABEL)];
  return from && to && from <= to ? { from, to } : null;
}

/** The statement's period as its header prints it, in whichever way. */
export function findHeaderPeriod(
  text: string,
  order: NumericDateOrder,
): { from: Date; to: Date } | null {
  return (
    findStatementPeriod(text, order) ??
    findSharedYearPeriod(text) ??
    findLabelledPeriod(text, order)
  );
}
