import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { readHeaderRow } from './pdf-layout-columns.helper';
import { leadingDate } from './pdf-layout-row-date.helper';
import { findStatementAmounts } from './statement-amount.helper';

/**
 * Statements that print an entry over two or three lines with its money on
 * the last ("Card Transaction 1000 13DEC23 ACME STORES" over "SAMPLETOWN GB
 * 27.62 10,059.49"), the date only on a day's first entry. The table reader
 * takes money from a row's first line, so each entry is laid out as one row:
 * the date (the day's, when the entry prints none) and the money on its
 * first line, the rest of its words below.
 */

const isMoney = (text: string) => findStatementAmounts(text).length > 0;
export const hasMoney = (row: PdfTextRow) => isMoney(row.text);

/** The words of a line's date, if it opens with one ("02 Aug 24", "14 DEC"). */
function dateWords(row: PdfTextRow) {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  return items.slice(0, leadingDate(items)?.used ?? 0);
}

function asOneRow(
  lines: PdfTextRow[],
  date: PdfTextRow['items'],
  printsMoney: (row: PdfTextRow) => boolean,
): PdfTextRow[] {
  const [first, ...rest] = lines;
  const last = lines.at(-1);
  // The money words of the last line: those the money test takes, one word at a time.
  const money =
    last?.items.filter(
      item => isMoney(item.text) && printsMoney({ ...last, items: [item], text: item.text }),
    ) ?? [];
  const carried = dateWords(first).length > 0 ? [] : date.map(item => ({ ...item, y: first.y }));
  const words = (line: PdfTextRow) =>
    line === first ? [] : line.items.filter(item => !money.includes(item));
  const opening = [
    ...carried,
    ...first.items.filter(item => !money.includes(item)),
    ...money.map(item => ({ ...item, y: first.items[0]?.y ?? item.y })),
  ];
  return [
    { ...first, items: opening, text: opening.map(item => item.text).join(' ') },
    ...rest.map(line => ({
      ...line,
      items: words(line),
      text: words(line)
        .map(item => item.text)
        .join(' '),
    })),
  ].filter(line => line.items.length > 0);
}

/**
 * Lays each entry out as one row. `opensEntry` tells the line that opens an
 * entry (a payment type code, or the line after an entry's money), given the
 * line read before it; an entry runs to its first line with money on the
 * same page. Lines outside any entry stay as they are.
 */
export function joinMoneyLastEntries(
  rows: PdfTextRow[],
  opensEntry: (row: PdfTextRow, before: PdfTextRow | null) => boolean,
  printsMoney: (row: PdfTextRow) => boolean = hasMoney,
): PdfTextRow[] {
  const out: PdfTextRow[] = [];
  let entry: PdfTextRow[] | null = null;
  let date: PdfTextRow['items'] = [];
  let before: PdfTextRow | null = null;
  for (const row of [...rows].sort((a, b) => a.page - b.page || a.y - b.y)) {
    const opens = opensEntry(row, before);
    before = row;
    if (opens) {
      out.push(...(entry ?? []));
      entry = [row];
      date = dateWords(row).length > 0 ? dateWords(row) : date;
    } else if (entry && entry[0].page === row.page) {
      entry.push(row);
    } else {
      out.push(...(entry ?? []), row);
      entry = null;
      continue;
    }
    if (printsMoney(row)) {
      out.push(...asOneRow(entry, date, printsMoney));
      entry = null;
    }
  }
  return [...out, ...(entry ?? [])];
}

/**
 * A table whose every entry runs from the line after the header, or after
 * the last entry's money, to the line that prints its own money. `isHeader`
 * tells the table's header; lines above the first header on a page are left
 * as they are.
 */
export function joinMoneyLastTable(
  rows: PdfTextRow[],
  isHeader: (row: PdfTextRow) => boolean,
): PdfTextRow[] {
  const headerAt = new Map<number, number>();
  let moneyFrom = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    if (isHeader(row) && !headerAt.has(row.page)) {
      headerAt.set(row.page, row.y);
      const money = (readHeaderRow(row) ?? []).filter(column => MONEY.includes(column.role));
      moneyFrom = Math.min(moneyFrom, ...money.map(column => column.x0 - MONEY_SLACK));
    }
  }
  // "Usa Usd 9.99 incl. Fee Aud $0.39" in the text is no money of the row's: only figures under the money headings are.
  const printsMoney = (row: PdfTextRow) =>
    Number.isFinite(moneyFrom)
      ? row.items.some(item => item.x >= moneyFrom && isMoney(item.text))
      : hasMoney(row);
  const inTable = (row: PdfTextRow) => row.y > (headerAt.get(row.page) ?? Number.POSITIVE_INFINITY);
  return joinMoneyLastEntries(
    rows,
    (row, before) =>
      inTable(row) &&
      before !== null &&
      before.page === row.page &&
      (isHeader(before) || printsMoney(before)),
    printsMoney,
  );
}

const MONEY: string[] = ['debit', 'credit', 'amount', 'balance'];
/** A figure right-aligned under its heading may start this far left of it, in points. */
const MONEY_SLACK = 40;
