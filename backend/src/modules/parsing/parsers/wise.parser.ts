import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { joinAmountLines } from '../helpers/pdf-layout-amount-lines.helper';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { parseStatementAmount } from '../helpers/statement-amount.helper';
import { parseDateParts } from '../helpers/statement-date.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The company's name and its help address. */
const WISE_NAME = /\bWise Payments (?:Ltd|Limited)\b/i;
const WISE_SITE = /\bwise\.com\b/i;

export function isWiseStatement(text: string): boolean {
  return WISE_NAME.test(text) && WISE_SITE.test(text);
}

/** "Sent money to MEMBER ONE   -30.00   0.00": the text, the signed amount and the balance after it. */
const ENTRY = /^(.+?)\s+(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$/;
/** "26 April 2023 | Transaction: TRANSFER-1000001": the date and the reference, on the line under. */
const DATED = /^(\d{1,2} [A-Za-z]+ \d{4})\s*\|\s*Transaction:\s*(\S+)/;

/**
 * Wise prints no table header: each movement is a line with its text,
 * signed amount and balance (the figures a hair lower than the text), over
 * a line with its date and reference.
 */
export function readWiseRows(rows: PdfTextRow[]): LayoutTransaction[] {
  const sorted = joinAmountLines(rows);
  const read: LayoutTransaction[] = [];
  sorted.forEach((row, index) => {
    const entry = ENTRY.exec(row.text.trim());
    const dated = DATED.exec(sorted[index + 1]?.text.trim() ?? '');
    const date = dated ? parseDateParts(dated[1], 'dmy') : null;
    const amount = entry ? parseStatementAmount(entry[2]) : null;
    const balance = entry ? parseStatementAmount(entry[3]) : null;
    if (!(entry && dated && date) || amount === null) {
      return;
    }
    read.push({
      date,
      dateText: dated[1],
      description: `${entry[1]} ${dated[2]}`,
      firstLine: entry[1],
      counterparty: '',
      ...(amount < 0 ? { debit: -amount } : { credit: amount }),
      ...(balance !== null ? { balance } : {}),
      at: { page: row.page, y: row.y },
    });
  });
  return read;
}

const KINDS: [RegExp, PaymentType, RegExp][] = [
  [/^Sent money to\b/i, 'bank_transfer_out', /^Sent money to (.+?)(?: TRANSFER-\d+)?$/i],
  [/^Received money from\b/i, 'bank_transfer_in', /^Received money from (.+?)(?: TRANSFER-\d+)?$/i],
  [
    /^Card transaction\b/i,
    'card',
    /^Card transaction of [\d.,]+ [A-Z]{3} issued by (.+?)(?: CARD_TRANSACTION-\d+)?$/i,
  ],
  [/\bfee\b/i, 'fee', /^()$/],
];

export function wiseEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, paymentType, party] of KINDS) {
    if (pattern.test(text)) {
      const name = party.exec(text)?.[1];
      return { ...row, paymentType, ...(name ? { counterpartyName: name } : {}) };
    }
  }
  return row;
}

/**
 * Wise (Wise Payments Ltd) account statement for one currency: the holder's
 * account details and the balance on the statement's last day, then each
 * movement as its text, signed amount and balance over a line with its date
 * and reference, newest first. This names the company and reads the
 * movements line by line.
 */
export class WiseParser extends BankPdfParser {
  protected readonly bank = BankName.WISE;

  protected recognises(text: string): boolean {
    return isWiseStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return readWiseRows(rows);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return wiseEntry(row);
  }
}
