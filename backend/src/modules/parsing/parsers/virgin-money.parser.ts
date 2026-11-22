import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/**
 * The bank's name, or, on a statement that prints its logo only, its sort
 * code range (82-, Clydesdale's) beside its table's header.
 */
const VIRGIN_NAME = /\bVirgin Money\b/i;
const VIRGIN_SORT_CODE = /\b82-\d{2}-\d{2}\b/;
const VIRGIN_HEADER = /\bDate\s+Description\s+Type\s+Debits\s+Credits\s+Balance\b/i;

export function isVirginMoneyStatement(text: string): boolean {
  return VIRGIN_NAME.test(text) || (VIRGIN_SORT_CODE.test(text) && VIRGIN_HEADER.test(text));
}

/** The Type column's word closes the text: "MOB, Member One, rent  Transfer". */
const TYPES: [RegExp, PaymentType | 'transfer'][] = [
  [/ (?:Card payment|Debit card|Card)$/i, 'card'],
  [/ Direct debit$/i, 'direct_debit'],
  [/ Standing order$/i, 'standing_order'],
  [/ (?:Cash|ATM)$/i, 'cash'],
  [/ (?:Interest)$/i, 'interest'],
  [/ (?:Charge|Fee)$/i, 'fee'],
  [/ (?:Transfer|Faster payment|Bank credit|Credit)$/i, 'transfer'],
];

export function virginMoneyEntry(row: ParsedTransaction): ParsedTransaction {
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
      // "MOB, Member One, rent": the party after the channel, before the reference.
      const party = text
        .slice(0, match.index)
        .replace(/^(?:MOB|IB|TEL),\s*/i, '')
        .split(',')[0]
        .trim();
      return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
    }
  }
  return row;
}

/**
 * Virgin Money (UK) statement: the account number, sort code and statement
 * dates, then Date, Description, Type, Debits, Credits and Balance from the
 * opening to the closing balance with the totals. The generic layout
 * reading does the table; this names the bank and reads each row's type and
 * party.
 */
export class VirginMoneyParser extends BankPdfParser {
  protected readonly bank = BankName.VIRGIN_MONEY;

  protected recognises(text: string): boolean {
    return isVirginMoneyStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return virginMoneyEntry(row);
  }
}
