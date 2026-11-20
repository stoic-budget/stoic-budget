import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { hasMoney, joinMoneyLastEntries } from '../helpers/pdf-layout-money-last.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's welcome line and its BIC. */
const NATWEST_NAME = /\bNatWest\b|\bnatwest\.com\b/i;
const NATWEST_BIC = /\bNWBKGB2L\b/;

export function isNatwestStatement(text: string): boolean {
  return NATWEST_NAME.test(text) && NATWEST_BIC.test(text);
}

/** "Date  Description  Paid In(£)  Withdrawn(£)  Balance(£)": the table's header. */
const isHeader = (row: PdfTextRow) => /\bDate\b.*\bDescription\b.*\bBalance\b/i.test(row.text);

/**
 * An entry opens on the line after the header or after the last entry's
 * money: its words run on until the line that prints its money.
 */
export function joinNatwestEntries(rows: PdfTextRow[]): PdfTextRow[] {
  const headerAt = new Map<number, number>();
  for (const row of rows) {
    if (isHeader(row) && !headerAt.has(row.page)) {
      headerAt.set(row.page, row.y);
    }
  }
  const inTable = (row: PdfTextRow) => row.y > (headerAt.get(row.page) ?? Number.POSITIVE_INFINITY);
  return joinMoneyLastEntries(
    rows,
    (row, before) =>
      inTable(row) &&
      before !== null &&
      before.page === row.page &&
      (isHeader(before) || hasMoney(before)),
  );
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^Card Transaction\b/i, 'card'],
  [/^Cash Withdrawal\b|^ATM\b/i, 'cash'],
  [/^Direct Debit\b/i, 'direct_debit'],
  [/^Standing Order\b/i, 'standing_order'],
  [
    /^(?:Automated Credit|OnLine Transaction|Online Transaction|Bill Payment|Transfer)\b/i,
    'transfer',
  ],
  [/\bCharges?\b|\bFee\b/i, 'fee'],
];

/** "Card Transaction 1000 13DEC23 C ACME STORES 4357 SAMPLETOWN GB": the shop after the card and day. */
const CARD_SHOP = /^Card Transaction \d{4} \d{2}[A-Z]{3}\d{2}(?: C)? (.+)$/i;

export function natwestEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const kind = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  if (!kind) {
    return row;
  }
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  const shop = CARD_SHOP.exec(text)?.[1];
  return { ...row, paymentType, ...(shop ? { counterpartyName: shop } : {}) };
}

/**
 * NatWest (UK) current account statement: a summary from the previous to
 * the new balance, then Date, Description, Paid In, Withdrawn and Balance,
 * each entry over one to three lines with its money on the last, the date
 * once a day. This names the bank, lays each entry out as one row for the
 * generic layout reading, and types the rows.
 */
export class NatwestParser extends BankPdfParser {
  protected readonly bank = BankName.NATWEST;

  protected recognises(text: string): boolean {
    return isNatwestStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(joinNatwestEntries(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return natwestEntry(row);
  }
}
