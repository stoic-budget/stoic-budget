import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's legal line at the foot of every page, and its BIC. */
const METRO_NAME = /\bMetro Bank PLC\b/i;
const METRO_BIC = /\bMYMBGB2L\b|\bMYMBGB2M\b|\bGB\d{2}MYMB\d{14}\b/;

export function isMetroBankStatement(text: string): boolean {
  return METRO_NAME.test(text) && METRO_BIC.test(text);
}

const KINDS: [RegExp, PaymentType][] = [
  // "Card Purchase 02/06/19 09:15:48 ACME STORE": the shop after the time.
  [/^Card Purchase(?: \d{2}\/\d{2}\/\d{2})?(?: \d{2}:\d{2}:\d{2})?\s*(.*)$/i, 'card'],
  [/^Inward (?:Fast )?Payments?\s+(.+)$/i, 'bank_transfer_in'],
  [/^Outward (?:Fast )?Payments?\s+(.+)$/i, 'bank_transfer_out'],
  [/^Direct Debit\s+(.+)$/i, 'direct_debit'],
  [/^Standing Order\s+(.+)$/i, 'standing_order'],
  [/^(?:Cash Withdrawal|ATM)\b()/i, 'cash'],
];

export function metroBankEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Metro Bank (UK) account statement: an account summary with the opening and
 * closing balances and money in and out, then Date, Transaction, Money Out,
 * Money In and Balance under "Your Transactions". The generic layout reading
 * does the table and the summary; this names the bank and reads the rows'
 * kinds and parties.
 */
export class MetroBankParser extends BankPdfParser {
  protected readonly bank = BankName.METRO_BANK;

  protected recognises(text: string): boolean {
    return isMetroBankStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return metroBankEntry(row);
  }
}
