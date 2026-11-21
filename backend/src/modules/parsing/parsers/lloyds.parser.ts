import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import { ukCodeEntry } from '../helpers/statement-uk-codes.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';
import { firstDayBalanceLabel, namesLloydsAccount } from './lloyds-group';

/** The summary's heading over the rows, as the group's statements print it. */
const TRANSACTIONS_HEADING = /\bYour Transactions\b/;

export function isLloydsStatement(text: string): boolean {
  return namesLloydsAccount(text) && TRANSACTIONS_HEADING.test(text);
}

/**
 * Lloyds Bank (UK) current account statement, laid out as the group's other
 * banks: Date, Description, Type, Money In, Money Out and Balance under "Your
 * Transactions". The generic layout reading does the rows and balances; this
 * names the bank by its account name and reads the Type column's codes.
 */
export class LloydsParser extends BankPdfParser {
  protected readonly bank = BankName.LLOYDS;

  protected recognises(text: string): boolean {
    return isLloydsStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    return firstDayBalanceLabel(await super.parse(filePath, text));
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ukCodeEntry(row);
  }
}
