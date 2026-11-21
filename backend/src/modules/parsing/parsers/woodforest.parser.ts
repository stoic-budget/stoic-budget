import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's web address and its mailing address in The Woodlands. */
const WOODFOREST_SITE = /\bwww\.woodforest\.com\b/i;
const WOODFOREST_ADDRESS = /\bThe Woodlands, TX 77387\b/i;
/** "Woodforest Checking 8231214415": the account's kind and number over its table. */
const ACCOUNT = /\bWoodforest [A-Za-z ]+? (\d{8,12})\b/;

export function isWoodforestStatement(text: string): boolean {
  return WOODFOREST_SITE.test(text) && WOODFOREST_ADDRESS.test(text);
}

export function woodforestAccount(text: string): string | null {
  return ACCOUNT.exec(text)?.[1] ?? null;
}

const KINDS: [RegExp, PaymentType | 'transfer', RegExp?][] = [
  [/^POS DB\b/i, 'card', /^POS DB (.+?)\s+\d{6,}$/i],
  [/\bATM\b/i, 'cash'],
  [/\b(?:FEE|SERVICE CHARGE)\b/i, 'fee'],
  [/\bINTEREST\b/i, 'interest'],
  [/^ACH-/i, 'direct_debit', /^ACH-\S+(?: \S+)? (.+)$/i],
  [/\b(?:DEPOSIT|TRF|XFER|Transfer)\b/i, 'transfer'],
];

export function woodforestEntry(row: ParsedTransaction): ParsedTransaction {
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
 * Woodforest National Bank (US) statement: a summary of the accounts from
 * the balance forward to the closing balance, then each account's
 * transactions with Date, Credits, Debits, Balance and Description, and a
 * daily closing balance summary. The generic layout reading does the table;
 * this names the bank, reads the account's number and types the rows.
 */
export class WoodforestParser extends BankPdfParser {
  protected readonly bank = BankName.WOODFOREST;

  protected recognises(text: string): boolean {
    return isWoodforestStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return woodforestAccount(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return woodforestEntry(row);
  }
}
