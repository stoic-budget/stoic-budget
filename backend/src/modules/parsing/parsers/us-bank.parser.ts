import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's legal name and its phone line ("1-800-US BANKS"). */
const US_BANK_NAME = /\bU\.S\. Bank National Association\b/i;
const US_BANK_PHONE = /\b1-800-US BANKS\b/i;

export function isUsBankStatement(text: string): boolean {
  return US_BANK_NAME.test(text) && US_BANK_PHONE.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:Debit Purchase|Card Purchase|POS)\b/i, 'card'],
  [/\bATM\b/i, 'cash'],
  [/\b(?:Fee|Service Charge)\b/i, 'fee'],
  [/\bInterest\b/i, 'interest'],
  [
    /^(?:Electronic (?:Deposit|Withdrawal)|Mobile Banking Transfer|Internet Banking Transfer|Deposit|Transfer)\b/i,
    'transfer',
  ],
];

export function usBankEntry(row: ParsedTransaction): ParsedTransaction {
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
  // "Electronic Deposit From ACME REF=…": the party after "From" or "To".
  const party = /\b(?:From|To) (.+?)(?: REF=.*)?$/i.exec(text)?.[1];
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * U.S. Bank (US) Uni-Statement: an account summary from the beginning to the
 * ending balance, then lists under their headings (deposits/credits, card
 * withdrawals, other withdrawals, checks paid) with Date, Description of
 * Transaction, Ref Number and Amount, then the daily balances. The generic
 * layout reading does the lists; this names the bank and reads each row's
 * kind and party.
 */
export class UsBankParser extends BankPdfParser {
  protected readonly bank = BankName.US_BANK;

  protected recognises(text: string): boolean {
    return isUsBankStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return usBankEntry(row);
  }
}
