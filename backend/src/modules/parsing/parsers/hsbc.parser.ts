import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { findStatementAmounts } from '../helpers/statement-amount.helper';
import { ukCodeEntry } from '../helpers/statement-uk-codes.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's site in the letterhead and the table's own heading. */
const HSBC_SITE = /\bwww\.hsbc\.co\.uk\b/i;
const HSBC_TABLE = /\bPay\s*m\s*e\s*nt\s+t\s*y\s*p\s*e\s+and\s+de\s*t\s*ails\b/i;

export function isHsbcStatement(text: string): boolean {
  return HSBC_SITE.test(text) && HSBC_TABLE.test(text);
}

/** The payment type codes that open an entry in the "Payment type" column. */
const ENTRY_CODES = new Set([
  'CR',
  'DR',
  'BP',
  'DD',
  'SO',
  'VIS',
  ')))',
  'ATM',
  'TFR',
  'OBP',
  'CHQ',
  'BGC',
]);

/** The words of a line's date, if it opens with one ("02 Aug 24"). */
function dateWords(row: PdfTextRow) {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  const dated =
    /^\d{1,2}$/.test(items[0]?.text ?? '') && /^[A-Za-z]{3}$/.test(items[1]?.text ?? '');
  if (!dated) {
    return [];
  }
  return items.slice(0, items.length > 2 && /^\d{2}$/.test(items[2].text) ? 3 : 2);
}

/** Whether a line opens an entry: its first word after the date, if any, is a payment type code. */
function opensEntry(row: PdfTextRow): boolean {
  const items = [...row.items].sort((a, b) => a.x - b.x);
  return ENTRY_CODES.has(items[dateWords(row).length]?.text ?? '');
}

const isMoney = (text: string) => findStatementAmounts(text).length > 0;
const hasMoney = (row: PdfTextRow) => isMoney(row.text);

/**
 * An entry's lines as the reader expects one row: the date (the day's, when
 * the line prints none) and the money on its first line, the rest of its
 * words below.
 */
function asOneRow(lines: PdfTextRow[], date: PdfTextRow['items']): PdfTextRow[] {
  const [first, ...rest] = lines;
  const money = lines.at(-1)?.items.filter(item => isMoney(item.text)) ?? [];
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
 * HSBC prints an entry over two or three lines: the code and the payee, a
 * reference, and its money on the last ("PLAYDALE  11,852.74"), the date
 * only on a day's first entry. Each entry is laid out as one row: date and
 * money on its first line, its words below.
 */
export function joinHsbcEntries(rows: PdfTextRow[]): PdfTextRow[] {
  const out: PdfTextRow[] = [];
  let entry: PdfTextRow[] | null = null;
  let date: PdfTextRow['items'] = [];
  for (const row of [...rows].sort((a, b) => a.page - b.page || a.y - b.y)) {
    if (opensEntry(row)) {
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
    if (hasMoney(row)) {
      out.push(...asOneRow(entry, date));
      entry = null;
    }
  }
  return [...out, ...(entry ?? [])];
}

/**
 * HSBC (UK) business statement: an account summary, then Date, Payment type
 * and details, Paid out, Paid in and Balance between the balances brought
 * and carried forward. This names the bank, joins each entry's lines and
 * reads its payment type code; the generic layout reading does the rest.
 */
export class HsbcParser extends BankPdfParser {
  protected readonly bank = BankName.HSBC;

  protected recognises(text: string): boolean {
    return isHsbcStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ukCodeEntry(row);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(joinHsbcEntries(rows));
  }
}
