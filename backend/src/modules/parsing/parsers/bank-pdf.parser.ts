import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/**
 * A bank's own PDF parser on top of the generic layout reading: it claims a
 * PDF filed under its bank, or under OTHER when the text is the bank's, and
 * may rework each row (payee, type, reference) of every account the file prints.
 */
export abstract class BankPdfParser extends GenericPdfParser {
  protected abstract readonly bank: BankName;

  /** Whether the statement's text is this bank's. */
  protected abstract recognises(text: string): boolean;

  /** A row as the bank prints it, reworked; as it is by default. */
  protected entry(row: ParsedTransaction): ParsedTransaction {
    return row;
  }

  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== this.bank && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return this.recognises(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    const rework = (account: ParsedStatement): ParsedStatement => ({
      ...account,
      transactions: account.transactions.map(row => this.entry(row)),
    });
    return {
      ...rework(statement),
      ...(statement.otherAccounts && { otherAccounts: statement.otherAccounts.map(rework) }),
    };
  }
}
