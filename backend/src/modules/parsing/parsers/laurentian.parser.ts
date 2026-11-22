import { BankName } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's head office in the letterhead and its statement's rule-set heading. */
const LAURENTIAN_OFFICE = /\b1360,?\s*BOUL\.?\s*RENE-LEVESQUE O\./i;
const LAURENTIAN_TABLE = /\bBALANCE - PREVIOUS STATEMENT\b/i;

/** "FROM MAY 24, 2023 TO MAY 31, 2023   391   286-2 01": branch, then the account. */
const ACCOUNT = /\bTO [A-Z]{3,9} \d{1,2}, \d{4}\s+\d{3}\s+(\d{3}-\d \d{2})\b/;

export function isLaurentianStatement(text: string): boolean {
  return LAURENTIAN_OFFICE.test(text) && LAURENTIAN_TABLE.test(text);
}

export function laurentianEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  if (/\bfee\b/i.test(text)) {
    return { ...row, paymentType: 'fee' };
  }
  if (/\binterest\b/i.test(text)) {
    return { ...row, paymentType: 'interest' };
  }
  return row;
}

/**
 * Laurentian Bank (Canada) chequing statement, drawn in Type 3 fonts with
 * underscore rules: Date, Description, Withdrawals, Deposits and Balance from
 * the balance of the previous statement to the new balance. The text
 * extractor reads it; the generic layout reading does the table; this names
 * the bank, keeps Canadian dollars and types fees.
 */
export class LaurentianParser extends BankPdfParser {
  protected readonly bank = BankName.LAURENTIAN;

  protected recognises(text: string): boolean {
    return isLaurentianStatement(text);
  }

  protected accountNumber(text: string): string | null {
    return ACCOUNT.exec(text)?.[1] ?? null;
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    return { ...statement, metadata: { ...statement.metadata, currency: 'CAD' } };
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return laurentianEntry(row);
  }
}
