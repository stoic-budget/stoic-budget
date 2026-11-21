import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name and its phone line ("844-4TRUIST"). */
const TRUIST_NAME = /\bTRUIST\b/;
const TRUIST_PHONE = /\b4TRUIST\b/i;

export function isTruistStatement(text: string): boolean {
  return TRUIST_NAME.test(text) && TRUIST_PHONE.test(text);
}

/** "BACK TO BASICS 1000000000001": the account's product name and number over its summary. */
const ACCOUNT = /^[A-Z][A-Z ]+ (\d{10,16})$/m;

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/\bATM\b.*\b(?:WITHDRAWAL|CASH)\b|\bCASH WITHDRAWAL\b/i, 'cash'],
  [/\bFEE\b/i, 'fee'],
  [/^DEBIT CARD\b/i, 'card'],
  [/\bINTEREST\b/i, 'interest'],
  [/\b(?:PAYROLL|TRANSFER|TRANFER|INTERNET PAYMENT|ZELLE|DEPOSIT|CREDIT)\b/i, 'transfer'],
];

export function truistEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Truist (US) account statement, often a scan read by OCR: an account
 * summary from the previous to the new balance, then "Other withdrawals,
 * debits and service charges" and "Deposits, credits and interest", each
 * list with Date, Description and Amount and its total. The generic layout
 * reading does the lists; this names the bank, takes the account number
 * printed with its product name and types the rows.
 */
export class TruistParser extends BankPdfParser {
  protected readonly bank = BankName.TRUIST;

  protected recognises(text: string): boolean {
    return isTruistStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return truistEntry(row);
  }
}
