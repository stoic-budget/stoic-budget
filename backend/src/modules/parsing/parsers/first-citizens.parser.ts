import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name as its statements print it, and the activity heading. */
const FIRST_CITIZENS_NAME = /\bFirst Citizens Bank\b|\bfirstcitizens\.com\b/i;
const ACTIVITY = /\bTransaction history\b|\bAccount activity\b|\bTransactions\b/i;

export function isFirstCitizensStatement(text: string): boolean {
  return FIRST_CITIZENS_NAME.test(text) && ACTIVITY.test(text);
}

const KINDS: [RegExp, PaymentType][] = [
  [/^Purchase authorized on\b/i, 'card'],
  [/^ATM Withdrawal\b/i, 'cash'],
  [/^ATM Cash Deposit\b/i, 'cash'],
  [/\bFee\b/i, 'fee'],
  [/^Money Transfer\b/i, 'bank_transfer_in'],
];

/** "Purchase authorized on 12/01 ACME Store Sampletown GA S3803… Card 2536": the shop after the date. */
const CARD_PURCHASE = /^Purchase authorized on \d{2}\/\d{2}\s+(.+?)\s+[SP]\d{12,}\b/i;

export function firstCitizensEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const paymentType = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  const shop = CARD_PURCHASE.exec(text)?.[1];
  return {
    ...row,
    ...(shop ? { counterpartyName: shop } : {}),
    ...(paymentType ? { paymentType } : {}),
  };
}

/**
 * First Citizens Bank (US) checking statement: "Transaction history" with
 * Date, Check Number, Description, Deposits/Additions,
 * Withdrawals/Subtractions and Ending daily balance. The generic layout
 * reading does the table (its headings are known to it); this names the
 * bank and reads the shop of a card purchase.
 */
export class FirstCitizensParser extends BankPdfParser {
  protected readonly bank = BankName.FIRST_CITIZENS;

  protected recognises(text: string): boolean {
    return isFirstCitizensStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return firstCitizensEntry(row);
  }
}
