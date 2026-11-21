import { BankName } from '../../../entities/statement.entity';
import { ukCodeEntry } from '../helpers/statement-uk-codes.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's site in the letterhead and its line under the rates. */
const FIRST_DIRECT_SITE = /\bfirstdirect\.com\b/i;
const FIRST_DIRECT_HSBC = /\bfirst direct is a division of HSBC\b/i;

export function isFirstDirectStatement(text: string): boolean {
  return FIRST_DIRECT_SITE.test(text) && FIRST_DIRECT_HSBC.test(text);
}

/**
 * first direct (HSBC UK) 1st Account statement: an account summary, then
 * Date, Payment type and details, Paid out, Paid in and Balance, between
 * "Balance brought forward" and "Balance carried forward", each row's text
 * after its payment type code (CR, BP, DD, VIS…). The generic layout reading
 * does the table, the balances and the period; this names the bank and reads
 * the codes.
 */
export class FirstDirectParser extends BankPdfParser {
  protected readonly bank = BankName.FIRST_DIRECT;

  protected recognises(text: string): boolean {
    return isFirstDirectStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ukCodeEntry(row);
  }
}
