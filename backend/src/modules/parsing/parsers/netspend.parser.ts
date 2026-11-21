import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The card program's web address in the service box, and the details table's title. */
const NETSPEND_SITE = /\bnetspend\.com\b/i;
const DETAILS = /\bYour Transaction Details\b/i;

export function isNetspendStatement(text: string): boolean {
  return NETSPEND_SITE.test(text) && DETAILS.test(text);
}

/** "Account Summary April 30, 2020. Account Number, 00001000000001": the number after a comma. */
const ACCOUNT = /\bAccount Number,?\s*(\d{8,20})\b/i;

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^ATM\b/i, 'cash'],
  [/^Direct debit\b/i, 'direct_debit'],
  [/^(?:Internet Transfer|Payroll|Deposit|Bill payment)\b/i, 'transfer'],
  [/\bFee\b/i, 'fee'],
  [/^(?:Purchase|POS|Card)\b/i, 'card'],
];

export function netspendEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Netspend (US) prepaid card account statement: an account summary from the
 * opening to the closing balance, then Date, Details, Withdrawals, Deposits
 * and Balance. The generic layout reading does the table; this names the
 * program, takes the account number printed after a comma and types the
 * rows.
 */
export class NetspendParser extends BankPdfParser {
  protected readonly bank = BankName.NETSPEND;

  protected recognises(text: string): boolean {
    return isNetspendStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return netspendEntry(row);
  }
}
