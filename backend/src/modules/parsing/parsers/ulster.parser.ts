import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';
import { joinNatwestEntries, natwestEntry } from './natwest.parser';

/** The bank's BIC and web address. */
const ULSTER_BIC = /\bULSBGB2B\b|\bULSBIE2D\b/;
const ULSTER_SITE = /\bulsterbank\.(?:co\.uk|ie)\b/i;

export function isUlsterStatement(text: string): boolean {
  return ULSTER_BIC.test(text) && ULSTER_SITE.test(text);
}

/**
 * Ulster Bank (Northern Ireland) current account statement, the NatWest
 * group's layout: a summary from the previous to the new balance, then
 * Date, Description, Paid In, Withdrawn and Balance, each entry over one to
 * three lines with its money on the last. This names the bank and reads
 * the rows as NatWest's are read (entries joined, types and shops).
 */
export class UlsterParser extends BankPdfParser {
  protected readonly bank = BankName.ULSTER;

  protected recognises(text: string): boolean {
    return isUlsterStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(joinNatwestEntries(rows), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return natwestEntry(row);
  }
}
