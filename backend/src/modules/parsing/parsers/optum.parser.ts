import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name and web address in the letterhead. */
const OPTUM_NAME = /\bOptum Bank\b/i;
const OPTUM_SITE = /\boptumbank\.com\b/i;

export function isOptumStatement(text: string): boolean {
  return OPTUM_NAME.test(text) && OPTUM_SITE.test(text);
}

const ACCOUNT = /\bParticipant Account ID:?\s*(\d{6,12})\b/i;

/** "578295 POS CHCKING SIG 06/17 02:09 ACME CLINIC SAMPLETOWN FL 96900096 57": the shop after the time. */
const CARD = /^(\d+) POS \w+ SIG \d{2}\/\d{2} \d{2}:\d{2} (.+?)(?: \d{6,}(?: \d+)?)?$/i;

export function optumEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const card = CARD.exec(text);
  if (card) {
    return { ...row, paymentType: 'card', documentNumber: card[1], counterpartyName: card[2] };
  }
  if (/\bCONTR(?:IBUTION)?\b/i.test(text)) {
    return { ...row, paymentType: 'bank_transfer_in' };
  }
  if (/\bINTEREST\b/i.test(text)) {
    return { ...row, paymentType: 'interest' };
  }
  return /\bFEE\b/i.test(text) ? { ...row, paymentType: 'fee' } : row;
}

/**
 * Optum Bank (US) health savings account statement: balances by account,
 * the period's summary, then the HSA cash account's Date, Description,
 * Deposits, Withdrawals and Balance, newest first, both money cells printed
 * on every row. The generic layout reading does the table; this names the
 * bank, takes the participant account ID and reads card payments and
 * contributions.
 */
export class OptumParser extends BankPdfParser {
  protected readonly bank = BankName.OPTUM;

  protected recognises(text: string): boolean {
    return isOptumStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return optumEntry(row);
  }
}
