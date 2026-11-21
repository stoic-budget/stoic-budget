import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name and its BIC ("CPBK GB 22"). */
const COOP_NAME = /\bThe Co-operative Bank\b/i;
const COOP_BIC = /\bCPBK ?GB ?22\b/i;

export function isCoOperativeStatement(text: string): boolean {
  return COOP_NAME.test(text) && COOP_BIC.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  // "COOP ATM12:35NOV30": the time glued to it.
  [/\bATM/i, 'cash'],
  [/\b(?:CHARGE|FEE|INTEREST CHARGED)\b/i, 'fee'],
  [/\bINTEREST\b/i, 'interest'],
  [/\b(?:CHB|TAX CREDIT|TFR|TRANSFER|FASTER PAYMENT|BACS|SALARY)\b/i, 'transfer'],
  [/\b(?:DD|DIRECT DEBIT)\b/i, 'direct_debit'],
  [/\b(?:POS|VISA|DEBIT CARD)\b/i, 'card'],
];

export function coOperativeEntry(row: ParsedTransaction): ParsedTransaction {
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
 * The Co-operative Bank (UK) statement, as its online banking prints it:
 * the account's title, number and sort code, then Date, Transaction, Money
 * in, Money out and Balance from the balance brought forward, each balance
 * signed after it ("£13.53+", "£67.39-" overdrawn). The generic layout
 * reading does the table; this names the bank and types the rows.
 */
export class CoOperativeBankParser extends BankPdfParser {
  protected readonly bank = BankName.CO_OPERATIVE_BANK;

  protected recognises(text: string): boolean {
    return isCoOperativeStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return coOperativeEntry(row);
  }
}
