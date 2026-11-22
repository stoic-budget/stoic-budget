import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's legal line at the foot of every page and the transactions' title. */
const SUNCORP_NAME = /\bSuncorp-Metway Ltd\b|\bSuncorp Bank\b/i;
const TRANSACTIONS = /\bAccount Transactions\b/i;

export function isSuncorpStatement(text: string): boolean {
  return SUNCORP_NAME.test(text) && TRANSACTIONS.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer', RegExp?][] = [
  [
    /^(?:VISA PURCHASE|EFTPOS PURCHASE|PAYPAL \*)/i,
    'card',
    /^(?:VISA PURCHASE|EFTPOS PURCHASE) (.+?)(?: \d{2}\/\d{2} AU.*)?$/i,
  ],
  [/^(?:ATM|CASH WITHDRAWAL)\b/i, 'cash'],
  [/^(?:DIRECT DEBIT)\b/i, 'direct_debit'],
  [/\b(?:FEE|CHARGE)\b/i, 'fee'],
  [/\bINTEREST\b/i, 'interest'],
  [
    /^(?:OSKO PAYMENT|INTERNET TRANSFER|BPAY|PAY ANYONE|TRANSFER)\b/i,
    'transfer',
    /\b(?:TO|FROM) ([A-Z][A-Z .&'-]+?)(?= [A-Z][a-z]| THANKS| REF\b|$)/,
  ],
];

export function suncorpEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const found = KINDS.find(([pattern]) => pattern.test(text));
  if (!found) {
    return row;
  }
  const [, kind, partyPattern] = found;
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  const party = partyPattern?.exec(text)?.[1];
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Suncorp Bank (Australia) account statement: an account summary from the
 * opening to the closing balance, then Date, Transaction Details,
 * Withdrawal, Deposit and Balance, each row's details over the lines under
 * it, the balance carried and brought forward between pages. The generic
 * layout reading does the table; this names the bank and reads each row's
 * kind and party (card shop, Osko and transfer payee or payer).
 */
export class SuncorpParser extends BankPdfParser {
  protected readonly bank = BankName.SUNCORP;

  protected recognises(text: string): boolean {
    return isSuncorpStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return suncorpEntry(row);
  }
}
