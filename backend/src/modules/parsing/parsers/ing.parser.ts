import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's Australian name and ABN, and the account's own name in the header. */
const ING_NAME = /\bING Bank \(Australia\)|\bABN 24 000 893 292\b/i;
const ING_ACCOUNT = /\bOrange Everyday\b|\bSavings Maximiser\b/i;

export function isIngStatement(text: string): boolean {
  return ING_NAME.test(text) && ING_ACCOUNT.test(text);
}

/** "Visa Purchase - Receipt 130125  ACME CAFE SAMPLETOWN  Date 30/02/23 Card 1000": the kind, then the shop. */
const KINDS: [RegExp, PaymentType][] = [
  [
    /^(?:Visa|EFTPOS) Purchase(?: with Cashout)? - Receipt \d+\s+(.+?)(?:\s+(?:Cash Amount|Date)\b.*)?$/i,
    'card',
  ],
  [/^(?:Visa|EFTPOS) Purchase\b()/i, 'card'],
  [/^Wave and Save Rebate\b()/i, 'interest'],
  [/^ATM Withdrawal\b()/i, 'cash'],
  [/^ATM Rebate\b()/i, 'fee'],
  [/^BPAY Bill Payment - Receipt \d+\s+(.+?)(?:\s+\d{6,}.*)?$/i, 'bank_transfer_out'],
  [/^(?:Salary )?Deposit\b()/i, 'bank_transfer_in'],
];

export function ingEntry(row: ParsedTransaction): ParsedTransaction {
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
 * ING (Australia) Orange Everyday statement: the balance summary, then Date,
 * Details, Money out, Money in and Balance, each entry's kind and receipt on
 * its first line and the shop and card below. The generic layout reading does
 * the table and the balances; this names the bank and reads each entry's
 * kind and shop.
 */
export class IngParser extends BankPdfParser {
  protected readonly bank = BankName.ING;

  protected recognises(text: string): boolean {
    return isIngStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ingEntry(row);
  }
}
