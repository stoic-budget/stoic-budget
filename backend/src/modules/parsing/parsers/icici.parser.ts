import { BankName } from '../../../entities/statement.entity';
import { indianRailType } from '../helpers/statement-india-rails.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's site and its statement heading. */
const ICICI_SITE = /\bwww\.icicibank\.com\b/i;
const ICICI_HEADING = /\bStatement of Transactions in\b/i;

export function isIciciStatement(text: string): boolean {
  return ICICI_SITE.test(text) && ICICI_HEADING.test(text);
}

/** The other side of a narration, segment by segment between slashes. */
const PARTIES: RegExp[] = [
  // "UPI/909319915190/UPI/member@okbank/State Bank Of I/": the handle.
  /^UPI\/\d+\/[^/]*\/([^/]+)\//i,
  // "MMT/IMPS/909318812658/ACME HAIR/AXIS BANK": the name.
  /^MMT\/IMPS\/\d+\/([^/]+)\//i,
  // "NEFT-UTIB0000001-ACME LTD-…".
  /^NEFT-[A-Z]{4}0[A-Z0-9]{6}-([^-]+)-/i,
  // "VPS/ACME STORE /2019…/…/CITY": a debit card purchase.
  /^VPS\/([^/]+?)\s*\//i,
];

export function iciciEntry(row: ParsedTransaction): ParsedTransaction {
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
 * ICICI Bank (India) savings statement: a summary of accounts, then "Statement
 * of Transactions" with Date, Mode, Particulars, Deposits, Withdrawals and
 * Balance, each narration starting on the line above its date and amounts in
 * lakhs ("1,02,801.86"). The generic layout reading does the table and the
 * balances; this names the bank and reads each narration's rail and party.
 */
export class IciciParser extends BankPdfParser {
  protected readonly bank = BankName.ICICI;

  protected recognises(text: string): boolean {
    return isIciciStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return iciciEntry(row);
  }
}
