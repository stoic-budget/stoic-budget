import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's legal line at the foot of every page and its account name. */
const KROO_NAME = /\bKroo Bank Ltd\b/i;
const KROO_ACCOUNT = /\bKroo Current Account\b/i;

export function isKrooStatement(text: string): boolean {
  return KROO_NAME.test(text) && KROO_ACCOUNT.test(text);
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^Card (?:payment|purchase)(?: to| at)?\s+(.+)$/i, 'card'],
  [/^Direct Debit(?: to)?\s+(.+)$/i, 'direct_debit'],
  [/^(?:Faster Payment|Transfer|Payment) (?:from|to)\s+(.+)$/i, 'transfer'],
  [/^Cash\b()/i, 'cash'],
  [/^Interest\b()/i, 'interest'],
];

export function krooEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  for (const [pattern, kind] of KINDS) {
    const match = pattern.exec(text);
    if (match) {
      const paymentType =
        kind === 'transfer'
          ? Number(row.credit) > 0
            ? 'bank_transfer_in'
            : 'bank_transfer_out'
          : kind;
      return { ...row, paymentType, ...(match[1] ? { counterpartyName: match[1] } : {}) };
    }
  }
  return row;
}

/**
 * Kroo (UK) current account statement: an overview of the main account and
 * pots, then Date, Description, Out, In and Balance between the opening and
 * the closing balance rows. The generic layout reading does the table and the
 * balances; this names the bank, reads "Out" and "In" as the money columns and
 * the rows' kinds and parties.
 */
export class KrooParser extends BankPdfParser {
  protected readonly bank = BankName.KROO;

  /** "Out" and "In" alone over the money: too short to be headings anywhere else. */
  protected reading: LayoutReading = {
    headings: new Map([
      ['out', 'debit'],
      ['in', 'credit'],
    ]),
  };

  protected recognises(text: string): boolean {
    return isKrooStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return krooEntry(row);
  }
}
