import { BankName } from '../../../entities/statement.entity';
import { indianRailType } from '../helpers/statement-india-rails.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's IFSC prefix and its statement heading. */
const HDFC_IFSC = /\bIFSC\s*:?\s*HDFC0\d{6}\b/i;
const HDFC_HEADING = /\bStatement of account\b/i;

export function isHdfcStatement(text: string): boolean {
  return HDFC_IFSC.test(text) && HDFC_HEADING.test(text);
}

/** HDFC's narrations name the other side after the rail and a code, between hyphens. */
const PARTIES: RegExp[] = [
  // "NEFT DR-UBIN0539686-MEMBER TWO-NETBANK, MUM-…", "RTGS CR-…"
  /^(?:NEFT|RTGS) (?:DR|CR)-[A-Z]{4}0[A-Z0-9]{6}-([^-]+)-/i,
  // "IMPS-123456789012-MEMBER TWO-UTIB-…"
  /^IMPS-\d+-([^-]+)-/i,
  // "UPI-MEMBER TWO-member@okbank-…": a name, or the handle when no name is printed.
  /^UPI-(?!\d+-)([^-]+)-/i,
  /^UPI-\d+-([^-@\s]+@[^-\s]+)/i,
  // "POS 416021XXXXXX1234 ACME STORE", "ATW-416021XXXXXX1234-ACME ATM"
  /^POS \S+ (.+)$/i,
];

export function hdfcEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const party = PARTIES.map(pattern => pattern.exec(text)?.[1]).find(Boolean);
  const paymentType = indianRailType(text, Number(row.credit) > 0);
  return {
    ...row,
    ...(party ? { counterpartyName: party.trim() } : {}),
    ...(paymentType ? { paymentType } : {}),
  };
}

/**
 * HDFC Bank (India) statement of account: Date, Narration, Chq./Ref.No.,
 * Value Dt, Withdrawal Amt., Deposit Amt. and Closing Balance, then a
 * summary. The generic layout reading does the table and the balances; this
 * names the bank and reads each narration's rail and other side.
 */
export class HdfcParser extends BankPdfParser {
  protected readonly bank = BankName.HDFC;

  protected recognises(text: string): boolean {
    return isHdfcStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return hdfcEntry(row);
  }
}
