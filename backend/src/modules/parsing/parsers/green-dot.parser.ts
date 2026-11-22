import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The company's line at the foot of every page, and its site in the contact box. */
const GREEN_DOT_FOOTER = /\bGreen Dot Corporation\b/;
const GREEN_DOT_SITE = /\bgreendot\.com\b/i;

export function isGreenDotStatement(text: string): boolean {
  return GREEN_DOT_FOOTER.test(text) && GREEN_DOT_SITE.test(text);
}

/** The Type column's words, printed beside the description: "Fee", "ATM Withdrawal", "Direct Deposit". */
const KINDS: [RegExp, PaymentType][] = [
  [/\bFee$/i, 'fee'],
  [/\bATM Withdrawal\b/i, 'cash'],
  [/\bDirect Deposit\b/i, 'bank_transfer_in'],
  [/\bPurchase\b/i, 'card'],
];

export function greenDotEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const paymentType = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  return paymentType ? { ...row, paymentType } : row;
}

/**
 * Green Dot (US prepaid debit account) statement: Date, Description, Type,
 * Amount and Available (the running balance), newest first, each row's text
 * set around its date; the balances in a box beside the table. The generic
 * layout reading does the table and, reading the rows oldest first, the
 * balances; this names the company and types the rows.
 */
export class GreenDotParser extends BankPdfParser {
  protected readonly bank = BankName.GREEN_DOT;

  protected recognises(text: string): boolean {
    return isGreenDotStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return greenDotEntry(row);
  }
}
