import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { readHeaderRow } from './pdf-layout-columns.helper';
import { HEADINGS } from './pdf-layout-headings.helper';
import { isNextLine } from './pdf-layout-wrapped.helper';
import { parseStatementAmount } from './statement-amount.helper';
import { type DateParts, foldText, parseDateParts } from './statement-date.helper';

/**
 * A table that prints two dates per row, one over the other: the booking date
 * on the row's first line and the day the payment was made on the line under
 * it ("Datum zaúčtování" over "Datum transakce", "Zaúčtování" over
 * "Provedení"). The lower date heads no row of its own; its line is the row's
 * text. Read as a row, the line would wait for money that never comes and
 * take the row's text with it.
 *
 * Only a table whose header stacks the payment's date under the booking date
 * is read so, and only up to the next header: elsewhere a dated line without
 * money can head the next row ("12 FEB ANZ ATM" over "GRIFFITH BRANCH
 * 500.00"). A value date ("Valuta") stacked the same way is no payment date:
 * it can come after the booking, and a row whose amount wraps would merge
 * into the one above. The payment is made on the booking day or before it.
 */

/** Headings of the payment's own date, printed under the booking date's. */
const LOWER_HEADINGS = [
  'datum transakce',
  'datum transakcie',
  'datum provedeni',
  'provedeno',
  'provedeni',
];

/** Columns sit this close to the heading over them, in points. */
const SAME_COLUMN = 4;
/** Words of one heading sit closer than this. */
const HEADING_WORD_GAP = 8;

/**
 * Whether one of `headings` starts at `x` on the line: its words, up to the
 * next column's gap, begin with the heading ("Datum zaúčtování" set tight
 * against "Operace" still begins with "datum zauctovani").
 */
function headingAt(row: PdfTextRow, x: number, headings: string[]): boolean {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  const start = items.findIndex(item => Math.abs(item.x - x) <= SAME_COLUMN);
  if (start === -1) {
    return false;
  }
  const words = [items[start]];
  for (const item of items.slice(start + 1)) {
    const last = words[words.length - 1];
    if (item.x - (last.x + last.width) > HEADING_WORD_GAP) {
      break;
    }
    words.push(item);
  }
  const folded = words.map(word => foldText(word.text));
  return folded.some((_, end) => headings.includes(folded.slice(0, end + 1).join(' ')));
}

/** Where the date column of a header that stacks two dates starts, or null. */
function stackedDateColumn(top: PdfTextRow, bottom: PdfTextRow | undefined): number | null {
  if (!(bottom && isNextLine(bottom, top))) {
    return null;
  }
  const [first] = [...top.items].sort((a, b) => a.x - b.x);
  if (!first) {
    return null;
  }
  return headingAt(top, first.x, HEADINGS.date) && headingAt(bottom, first.x, LOWER_HEADINGS)
    ? first.x
    : null;
}

const byX = (row: PdfTextRow) => [...row.items].sort((a, b) => a.x - b.x);

/**
 * The date the line starts with in the date column, day first as Czech and
 * Slovak print it, and how many words it takes: "1.3.2026" is one, "28. 2.
 * 2026" three.
 */
function dateAt(row: PdfTextRow, x: number): { parts: DateParts; words: number } | null {
  const items = byX(row);
  if (!items[0] || Math.abs(items[0].x - x) > SAME_COLUMN) {
    return null;
  }
  for (let words = 3; words >= 1; words -= 1) {
    const text = items
      .slice(0, words)
      .map(item => item.text)
      .join(' ');
    const parts = items.length >= words ? parseDateParts(text, 'dmy') : null;
    if (parts) {
      return { parts, words };
    }
  }
  return null;
}

/** Whether `lower` falls on `upper` or before it; without a year, within the same or the previous month. */
function notAfter(lower: DateParts, upper: DateParts): boolean {
  const year = (parts: DateParts, fallback: number) => parts.year ?? fallback;
  const time = (parts: DateParts, y: number) => new Date(y, parts.month - 1, parts.day).getTime();
  const upperYear = year(upper, 2000);
  const lowerYear = lower.year ?? (lower.month > upper.month ? upperYear - 1 : upperYear);
  return time(lower, lowerYear) <= time(upper, upperYear);
}

const hasMoney = (row: PdfTextRow) =>
  row.items.some(item => parseStatementAmount(item.text) !== null);

/**
 * The rows, with the lower date taken off each line under a dated row in a
 * table that stacks two dates; a line holding only that date is left out.
 */
export function withoutStackedDates(rows: PdfTextRow[]): PdfTextRow[] {
  const ordered = [...rows].sort((a, b) => a.page - b.page || a.y - b.y);
  const read: PdfTextRow[] = [];
  let dateColumn: number | null = null;
  let headerLine = false;
  for (const [index, row] of ordered.entries()) {
    const stacked = stackedDateColumn(row, ordered[index + 1]);
    if (stacked !== null) {
      dateColumn = stacked;
      headerLine = true;
    } else if (headerLine) {
      // The header's second line.
      headerLine = false;
    } else if (readHeaderRow(row)) {
      // Another table's header: its dates are its own.
      dateColumn = null;
    }
    const above = read[read.length - 1];
    const lower = dateColumn === null ? null : dateAt(row, dateColumn);
    const upper = dateColumn === null || !above ? null : dateAt(above, dateColumn);
    const isLowerDate =
      lower !== null &&
      upper !== null &&
      isNextLine(row, above) &&
      !hasMoney(row) &&
      hasMoney(above) &&
      notAfter(lower.parts, upper.parts);
    if (!isLowerDate) {
      read.push(row);
      continue;
    }
    const date = byX(row).slice(0, lower.words);
    const items = row.items.filter(item => !date.includes(item));
    if (items.length > 0) {
      read.push({ ...row, items, text: items.map(item => item.text).join(' ') });
    }
  }
  return read;
}
