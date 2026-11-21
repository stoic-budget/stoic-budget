import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's registered name and ABN in the letterhead. */
const HERITAGE_NAME = /\bHeritage Bank Limited\b/;
const HERITAGE_ABN = /\bABN 32 087 652 024\b/;

export function isHeritageStatement(text: string): boolean {
  return HERITAGE_NAME.test(text) && HERITAGE_ABN.test(text);
}

const KINDS: [RegExp, PaymentType][] = [
  [/^(?:Refund of )?POS purchase at (.+)$/i, 'card'],
  [/^Transfer from\b()/i, 'bank_transfer_in'],
  [/^Transfer to\b()/i, 'bank_transfer_out'],
  [/^Interest\b()/i, 'interest'],
  [/\bFee\b()/i, 'fee'],
];

export function heritageEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, paymentType] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      return { ...row, paymentType, ...(match[1] ? { counterpartyName: match[1] } : {}) };
    }
  }
  return row;
}

/**
 * Heritage Bank (Australia) Visa statement: an account summary (opening and
 * closing balance marked DR), then Date, Transaction Details, Debit, Credit
 * and Balance between the opening and the closing balance rows. The generic
 * layout reading does the table and the balances; this names the bank and
 * reads each row's kind and shop.
 */
export class HeritageParser extends BankPdfParser {
  protected readonly bank = BankName.HERITAGE;

  protected recognises(text: string): boolean {
    return isHeritageStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return heritageEntry(row);
  }
}
