import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's account line and its site in the notes. */
const GOTYME_ACCOUNT = /\bGoTyme Bank Account\b/;
const GOTYME_SITE = /\bgotyme\.com\.ph\b/i;

export function isGotymeStatement(text: string): boolean {
  return GOTYME_ACCOUNT.test(text) && GOTYME_SITE.test(text);
}

/** What a row says it is, and the party it names. */
const KINDS: [RegExp, PaymentType][] = [
  [/^Card payment at (.+?), Card\b/i, 'card'],
  [/^In-app purchase for .+? from (.+?), for\b/i, 'card'],
  [/^Refund for card payment()/i, 'card'],
  [/^Transfer from (.+?) GoTyme Bank\b/i, 'bank_transfer_in'],
  [/^Transfer to (.+?) GoTyme Bank\b/i, 'bank_transfer_out'],
  [/^Inbound interbank transfer()/i, 'bank_transfer_in'],
  [/^Outbound interbank transfer()/i, 'bank_transfer_out'],
];

export function gotymeEntry(row: ParsedTransaction): ParsedTransaction {
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
 * GoTyme Bank (Philippines) statement of account: a summary in PHP, then
 * Date, Details, Credits, Debits and Running Balance. The generic layout
 * reading does the table and the balances; this names the bank and reads
 * each row's kind and party.
 */
export class GotymeParser extends BankPdfParser {
  protected readonly bank = BankName.GOTYME;

  protected recognises(text: string): boolean {
    return isGotymeStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return gotymeEntry(row);
  }
}
