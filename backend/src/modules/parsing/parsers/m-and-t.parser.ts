import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's legal name or its web address, as its statements print them. */
const MT_NAME = /\bManufacturers and Traders Trust Company\b|\bmtb\.com\b|\bM&T Bank\b/i;
const ACTIVITY = /\bDeposits\b|\bWithdrawals\b|\bTransactions\b/i;

export function isMAndTStatement(text: string): boolean {
  return MT_NAME.test(text) && ACTIVITY.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:POS|DEBIT CARD|PURCHASE)\b/i, 'card'],
  [/\bATM\b/i, 'cash'],
  [/^(?:ACH|CCD|ELECTRONIC)\b/i, 'transfer'],
  [/\b(?:FEE|SERVICE CHARGE)\b/i, 'fee'],
  [/\bINTEREST\b/i, 'interest'],
];

export function mAndTEntry(row: ParsedTransaction): ParsedTransaction {
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
  return { ...row, paymentType };
}

/**
 * M&T Bank (US) checking statement: an account summary, then deposits and
 * withdrawals listed under headings of their own with their totals. The
 * generic layout reading does the lists and balances; this names the bank
 * and types the rows.
 */
export class MAndTParser extends BankPdfParser {
  protected readonly bank = BankName.M_AND_T;

  protected recognises(text: string): boolean {
    return isMAndTStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return mAndTEntry(row);
  }
}
