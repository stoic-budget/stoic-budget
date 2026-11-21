import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name and address in the letterhead. */
const USAA_NAME = /\bUSAA Federal Savings Bank\b/i;
const USAA_ADDRESS = /\b10750 McDermott Freeway\b/i;

export function isUsaaStatement(text: string): boolean {
  return USAA_NAME.test(text) && USAA_ADDRESS.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:POS|DEBIT CARD|CARD PURCHASE)\b/i, 'card'],
  [/^(?:ATM|CASH)\b/i, 'cash'],
  [/\b(?:FEE|SERVICE CHARGE)\b/i, 'fee'],
  [/\bINTEREST\b/i, 'interest'],
  [/^(?:ACH|USAA CREDIT|USAA DEBIT|ZELLE|TRANSFER|DEPOSIT|MOBILE)\b/i, 'transfer'],
];

export function usaaEntry(row: ParsedTransaction): ParsedTransaction {
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
  // "USAA CREDIT Zelle: Member One 1000000001": the person after "Zelle:".
  const party = /\bZelle: (.+?)(?: \d{6,})?$/i.exec(text)?.[1];
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * USAA Federal Savings Bank (US) checking statement: an activity summary
 * from the beginning to the ending balance, a fees box, then Date,
 * Description, Debits, Credits and Balance, each row's details on the
 * lines under it. The generic layout reading does the table; this names
 * the bank and types the rows (a Zelle payment's person).
 */
export class UsaaParser extends BankPdfParser {
  protected readonly bank = BankName.USAA;

  protected recognises(text: string): boolean {
    return isUsaaStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return usaaEntry(row);
  }
}
