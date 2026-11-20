import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import { ukCodeEntry } from '../helpers/statement-uk-codes.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';
import { firstDayBalanceLabel } from './lloyds-group';

/** The logo's text and the summary's dated balance lines. */
const HALIFAX_LOGO = /\blogo, Halifax\b|\bHalifax is a division of Bank of Scotland\b/i;
const HALIFAX_SUMMARY = /\bYour Transactions\b/;

export function isHalifaxStatement(text: string): boolean {
  return HALIFAX_LOGO.test(text) && HALIFAX_SUMMARY.test(text);
}

/**
 * Halifax (UK) current account statement, an accessible PDF: each row under
 * its own header of Date, Description, Type, Money In, Money Out and
 * Balance, with labels for screen readers printed under a point high (the
 * extractor leaves them out). The generic layout reading does the rows and
 * balances; this names the bank and reads the Type column's codes (BGC, FPO,
 * DEB…). The summary's "Balance on <first day>" is the balance after that
 * day's first row, not before it (see lloyds-group).
 */
export class HalifaxParser extends BankPdfParser {
  protected readonly bank = BankName.HALIFAX;

  protected recognises(text: string): boolean {
    return isHalifaxStatement(text);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    return firstDayBalanceLabel(await super.parse(filePath, text));
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return ukCodeEntry(row);
  }
}
