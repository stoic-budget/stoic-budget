import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name in the letterhead and the credit union it is a business name of. */
const GSB_NAME = /\bGreat Southern Bank\b/;
const GSB_CUA = /\bCredit Union Australia\b/i;

export function isGreatSouthernStatement(text: string): boolean {
  return GSB_NAME.test(text) && GSB_CUA.test(text);
}

/** What a row says it is, and the party it names. */
const KINDS: [RegExp, PaymentType][] = [
  // "Card Purchase VISA ACME STORE Sampletown 280123": the shop before the purchase date.
  [/^Card Purchase (?:VISA|PAYW|EFTPOS) (.+?)(?:\s+\d{6})?$/i, 'card'],
  [/^Intl Visa Fee()/i, 'fee'],
  [/^Interest Paid()/i, 'interest'],
  [/^(?:From:|ePayment From:)\s*(.+?)(?:\s+REF:.*)?$/i, 'bank_transfer_in'],
  [/^Fast Pymt In\b\s*(.*)$/i, 'bank_transfer_in'],
  [/^Fast Pymt Out\b\s*(.*)$/i, 'bank_transfer_out'],
  [/^TXN INITIATED BY-\d+ TRANSFER TO \d+ \d+ (.+)$/i, 'bank_transfer_out'],
];

export function greatSouthernEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Great Southern Bank (Credit Union Australia) statement: a summary of every
 * account, then each account's transaction history under "Account: <number>"
 * with Date, Description, Debits, Credits and Balance from its opening
 * balance. The generic layout reading does the tables, the accounts and their
 * balances; this names the bank and reads each row's kind and party.
 */
export class GreatSouthernParser extends BankPdfParser {
  protected readonly bank = BankName.GREAT_SOUTHERN;

  protected recognises(text: string): boolean {
    return isGreatSouthernStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return greatSouthernEntry(row);
  }
}
