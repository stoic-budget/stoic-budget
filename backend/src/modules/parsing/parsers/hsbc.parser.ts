import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import { joinMoneyLastEntries } from '../helpers/pdf-layout-money-last.helper';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
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

/**
 * HSBC prints an entry over two or three lines: the code and the payee, a
 * reference, and its money on the last ("PLAYDALE  11,852.74"), the date
 * only on a day's first entry. Each entry opens at its payment type code.
 */
export function joinHsbcEntries(rows: PdfTextRow[]): PdfTextRow[] {
  return joinMoneyLastEntries(rows, opensEntry);
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
