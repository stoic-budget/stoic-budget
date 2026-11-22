import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's web address and its BIC. */
const STARLING_SITE = /\bwww\.starlingbank\.com\b/i;
const STARLING_BIC = /\bSRLGGB2L\b/;

export function isStarlingStatement(text: string): boolean {
  return STARLING_SITE.test(text) && STARLING_BIC.test(text);
}

/** The Type column's words open the text: "FASTER PAYMENT  Member One (rent)". */
const TYPES: [RegExp, PaymentType | 'transfer'][] = [
  [
    /^(?:CONTACTLESS|CHIP & PIN|ONLINE PAYMENT|CARD SUBSCRIPTION|CARD PAYMENT|APPLE PAY|GOOGLE PAY|MASTERCARD)\b/i,
    'card',
  ],
  [/^DIRECT DEBIT\b/i, 'direct_debit'],
  [/^STANDING ORDER\b/i, 'standing_order'],
  [/^(?:CASH WITHDRAWAL|ATM)\b/i, 'cash'],
  [/^(?:DEPOSIT INTEREST|INTEREST)\b/i, 'interest'],
  [/^(?:FASTER PAYMENT|BANK TRANSFER|DEPOSIT)\b/i, 'transfer'],
];

export function starlingEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, kind] of TYPES) {
    const match = pattern.exec(text);
    if (match) {
      const paymentType =
        kind === 'transfer'
          ? Number(row.credit) > 0
            ? 'bank_transfer_in'
            : 'bank_transfer_out'
          : kind;
      // "Member One (rent)": the party, without the reference in brackets.
      const party = text
        .slice(match[0].length)
        .replace(/\s*\([^)]*\)\s*$/, '')
        .trim();
      return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
    }
  }
  return row;
}

/**
 * Starling Bank (UK) statement: a summary from the opening to the closing
 * balance, then Date, Type, Transaction, In, Out and the end-of-day account
 * balance. "In" and "Out" are too short to be headings for every bank, so
 * this reads them as the money columns; the generic layout reading does
 * the rest. Each row's type and party are read from its text.
 */
export class StarlingParser extends BankPdfParser {
  protected readonly bank = BankName.STARLING;

  protected reading: LayoutReading = {
    headings: new Map([
      ['in', 'credit'],
      ['out', 'debit'],
    ]),
  };

  protected recognises(text: string): boolean {
    return isStarlingStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return starlingEntry(row);
  }
}
