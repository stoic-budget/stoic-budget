import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's web address and its mailing address in Waterbury. */
const WEBSTER_SITE = /\bwebsterbank\.com\b/i;
const WEBSTER_ADDRESS = /\bWaterbury, CT 06720\b/i;

export function isWebsterStatement(text: string): boolean {
  return WEBSTER_SITE.test(text) && WEBSTER_ADDRESS.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/\b(?:POS|DBT CRD|DEBIT CARD|PURCHASE)\b/i, 'card'],
  [/\bATM\b/i, 'cash'],
  [/\b(?:FEE|SERVICE CHARGE)\b/i, 'fee'],
  [/\bINTEREST\b/i, 'interest'],
  [/\b(?:AUTO PYMT|EPAY|PAYMNT|PAYMENT|UTILITYBIL|ACH DEBIT|BILL ?PAY)\b/i, 'direct_debit'],
  [/\b(?:TRANSFER|DEPOSIT|PAYROLL|ZELLE)\b/i, 'transfer'],
];

export function websterEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Webster Bank (US) statement: a summary of the accounts, then each
 * account's summary from the beginning to the ending balance and its
 * transaction activity with Date, Description, Debits, Credits and
 * Balance, each row's payer and reference under it. The generic layout
 * reading does the table; this names the bank and types the rows.
 */
export class WebsterParser extends BankPdfParser {
  protected readonly bank = BankName.WEBSTER;

  protected recognises(text: string): boolean {
    return isWebsterStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return websterEntry(row);
  }
}
