import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's legal name in the contact box and its phone line. */
const WELLS_NAME = /\bWells Fargo Bank, N\.A\./i;
const WELLS_PHONE = /\b1-800-TO-WELLS\b/i;

export function isWellsFargoStatement(text: string): boolean {
  return WELLS_NAME.test(text) && WELLS_PHONE.test(text);
}

/**
 * The transaction history closes with its "Totals" line; the summaries after
 * it (checks written, items returned unpaid) repeat or explain its rows and
 * are no movements of their own.
 */
export function upToTotals(rows: PdfTextRow[]): PdfTextRow[] {
  const sorted = [...rows].sort((a, b) => a.page - b.page || a.y - b.y);
  const totals = sorted.findIndex(row => /^Totals\b/i.test(row.text.trim()));
  return totals < 0 ? sorted : sorted.slice(0, totals + 1);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:Purchase|Recurring Payment) authorized on\b/i, 'card'],
  [/\bATM Withdrawal\b|\bCash\b/i, 'cash'],
  [/\b(?:Fee|Service Charge)\b/i, 'fee'],
  [/\bInterest\b/i, 'interest'],
  [/^(?:Money Transfer|Online Transfer|Zelle|Mobile Deposit|Deposit|Edeposit)\b/i, 'transfer'],
];

/** "Purchase authorized on 12/07 ACME Store Sampletown TX P300000000000000 Card 1000": the shop after the date. */
const CARD_SHOP =
  /^(?:Purchase|Recurring Payment) authorized on \d{2}\/\d{2} (.+?)\s+[SP]\d{10,}\b/i;

export function wellsFargoEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Wells Fargo (US) checking statement: a summary from the beginning to the
 * ending balance, then the transaction history with Date, Check Number,
 * Description, Deposits/Additions, Withdrawals/Subtractions and Ending daily
 * balance, closed by its totals, then summaries of checks written and items
 * returned. The generic layout reading does the history (its headings are
 * known to it); this names the bank, stops at the totals and reads card
 * purchases' shop.
 */
export class WellsFargoParser extends BankPdfParser {
  protected readonly bank = BankName.WELLS_FARGO;

  protected recognises(text: string): boolean {
    return isWellsFargoStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(upToTotals(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return wellsFargoEntry(row);
  }
}
