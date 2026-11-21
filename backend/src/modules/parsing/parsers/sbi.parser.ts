import { BankName } from '../../../entities/statement.entity';
import { indianRailType } from '../helpers/statement-india-rails.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name over the statement and its IFSC prefix. */
const SBI_NAME = /\bSTATE BANK OF INDIA\b/i;
const SBI_IFSC = /\bSBIN0\d{6}\b/;

export function isSbiStatement(text: string): boolean {
  return SBI_NAME.test(text) && SBI_IFSC.test(text);
}

/**
 * The Ref/Cheque No. column prints "000000" when there is none, and an
 * empty money cell prints "-": both land in the text and are dropped.
 */
export function sbiNarration(text: string): string {
  return text
    .replace(/\b0{6}\b/g, ' ')
    .replace(/(^|\s)-(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sbiEntry(row: ParsedTransaction): ParsedTransaction {
  const text = sbiNarration(row.paymentPurpose);
  const isCredit = Number(row.credit) > 0;
  const paymentType = /^CASH (?:Withdrawn|Deposited)\b/i.test(text)
    ? 'cash'
    : /^ACH ?Cr\b/i.test(text)
      ? 'bank_transfer_in'
      : /^COMM\b/i.test(text)
        ? 'fee'
        : indianRailType(text, isCredit);
  return {
    ...row,
    paymentPurpose: text,
    counterpartyName: text,
    ...(paymentType ? { paymentType } : {}),
  };
}

/**
 * State Bank of India statement of account: the customer's details, IFSC
 * and balance, then Txn Date, Value Date, Description, Ref/Cheque No.,
 * Debit, Credit and Balance ("CR"), each row's narration over the lines
 * around its date. The generic layout reading does the table; this names
 * the bank, drops the empty reference and money cells from the text and
 * reads the payment rails.
 */
export class SbiParser extends BankPdfParser {
  protected readonly bank = BankName.SBI;

  protected recognises(text: string): boolean {
    return isSbiStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return sbiEntry(row);
  }
}
