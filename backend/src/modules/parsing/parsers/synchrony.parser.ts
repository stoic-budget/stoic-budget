import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name and web address in the "Managing Your Accounts" box. */
const SYNCHRONY_NAME = /\bSynchrony Bank\b/i;
const SYNCHRONY_SITE = /\bsynchronybank\.com\b/i;

export function isSynchronyStatement(text: string): boolean {
  return SYNCHRONY_NAME.test(text) && SYNCHRONY_SITE.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^ATM W\/D\b/i, 'cash'],
  [/^(?:Surcharge|ATM REBATE|.*\bFEE\b)/i, 'fee'],
  [/^INT(?:EREST)? (?:PMT|PAID)\b|^Interest\b/i, 'interest'],
  [/\b(?:TRANSFER|DEPOSIT|WITHDRAWAL|ACH)\b/i, 'transfer'],
];

export function synchronyEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Synchrony Bank (US) savings statement: a summary of accounts, each
 * account's summary and interest, then Post Date, Effective Date,
 * Description, Debits, Credits and Balance from the beginning balance. The
 * generic layout reading does the table; this names the bank and types
 * cash, fees, interest and transfers.
 */
export class SynchronyParser extends BankPdfParser {
  protected readonly bank = BankName.SYNCHRONY;

  protected recognises(text: string): boolean {
    return isSynchronyStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return synchronyEntry(row);
  }
}
