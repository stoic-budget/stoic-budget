import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's web address and phone line in the help box, and its account name. */
const NATIONWIDE_SITE = /\bnationwide\.co\.uk\b/i;
const NATIONWIDE_PHONE = /\b0800 30 20 11\b/;
/** "YourFlexAccount": the account name, glued to "Your" at times. */
const NATIONWIDE_ACCOUNT = /Flex(?:Account|Direct|Plus|Basic|One)\b/i;

export function isNationwideStatement(text: string): boolean {
  return (
    (NATIONWIDE_SITE.test(text) || NATIONWIDE_PHONE.test(text)) && NATIONWIDE_ACCOUNT.test(text)
  );
}

const KINDS: [RegExp, PaymentType | 'transfer'][] = [
  [/^(?:Visa|Contactless|Card)\b/i, 'card'],
  [/^Cash Machine\b|^ATM\b/i, 'cash'],
  [/^Direct Debit\b/i, 'direct_debit'],
  [/^Standing Order\b/i, 'standing_order'],
  [/^(?:Transfer|Bank Credit|Payment)\b/i, 'transfer'],
  [/\bInterest\b/i, 'interest'],
];

export function nationwideEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Nationwide Building Society (UK) FlexAccount statement: Date, Description,
 * "£ Out", "£ In" and "£ Balance", the dates without their year ("6-Apr"),
 * a box of balances and the help lines to the right. The generic layout
 * reading does the table; this names the bank, reads "Out" and "In" as its
 * money columns and types the rows.
 */
export class NationwideParser extends BankPdfParser {
  protected readonly bank = BankName.NATIONWIDE;

  /** "£ Out" and "£ In": too short to be headings for every bank. */
  protected reading: LayoutReading = {
    headings: new Map([
      ['out', 'debit'],
      ['in', 'credit'],
    ]),
  };

  protected recognises(text: string): boolean {
    return isNationwideStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return nationwideEntry(row);
  }
}
