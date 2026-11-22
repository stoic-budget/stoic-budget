import { BankName } from '../../../entities/statement.entity';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The payment address's bank name and the summary's heading. */
const MERRICK_NAME = /\bMERRICK BANK\b/i;
const MERRICK_SUMMARY = /\bMERRICK ACCOUNT SUMMARY\b/i;

export function isMerrickStatement(text: string): boolean {
  return MERRICK_NAME.test(text) && MERRICK_SUMMARY.test(text);
}

/** "2449215PHRS9MMW9K  ACME STORE  SAMPLETOWN CA": the reference number before the merchant. */
const REFERENCE = /^([0-9A-Z]{15,20})\s+(.+)$/;

export function merrickEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const reference = REFERENCE.exec(text);
  if (reference && /\d/.test(reference[1]) && /[A-Z]/.test(reference[1])) {
    const paid = Number(row.credit) > 0;
    return {
      ...row,
      paymentPurpose: reference[2],
      counterpartyName: reference[2],
      documentNumber: reference[1],
      paymentType: paid ? 'bank_transfer_in' : 'card',
    };
  }
  if (/\bFEE\b/i.test(text)) {
    return { ...row, paymentType: 'fee' };
  }
  if (/^Interest Charge\b/i.test(text)) {
    return { ...row, paymentType: 'interest' };
  }
  return /\bPAYMENT\b/i.test(text) && Number(row.credit) > 0
    ? { ...row, paymentType: 'bank_transfer_in' }
    : row;
}

/**
 * Merrick Bank (US) credit card statement: a payment slip, the account
 * summary from the previous to the new balance, then transactions, fees and
 * interest charged, each list with its total. The generic layout reading
 * does the lists and the card's balances (owed, so below zero); this names
 * the bank, takes each purchase's reference number apart and types the rows.
 */
export class MerrickParser extends BankPdfParser {
  protected readonly bank = BankName.MERRICK;

  protected recognises(text: string): boolean {
    return isMerrickStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return merrickEntry(row);
  }
}
