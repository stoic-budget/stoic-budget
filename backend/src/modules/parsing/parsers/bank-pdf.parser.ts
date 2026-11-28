import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/**
 * A bank's own PDF parser on top of the generic layout reading: it claims a
 * PDF filed under its bank, or under OTHER when the text is the bank's, and
 * may name the account its own way and rework each row (payee, type,
 * reference) of every account the file prints.
 */
export abstract class BankPdfParser extends GenericPdfParser {
  protected abstract readonly bank: BankName;

  /** Whether the statement's text is this bank's. */
  protected abstract recognises(text: string): boolean;

  /** The account the statement is for, when the bank prints it its own way. */
  protected accountNumber(_text: string): string | null {
    return null;
  }

  /**
   * The account's currency when the bank prints it its own way (a header line,
   * the balances): it then stands for the statement and every row, not the
   * most printed code, which payments abroad can outnumber.
   */
  protected accountCurrency(_text: string): string | null {
    return null;
  }

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
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const parsed = await super.parse(filePath, text);
    const accountNumber = parsed.otherAccounts ? null : this.accountNumber(text);
    const currency = parsed.otherAccounts ? null : this.accountCurrency(text);
    const statement = {
      ...parsed,
      metadata: {
        ...parsed.metadata,
        ...(accountNumber && { accountNumber }),
        ...(currency && { currency }),
      },
    };
    const rework = (account: ParsedStatement): ParsedStatement => ({
      ...account,
      transactions: account.transactions.map(row =>
        this.entry(currency ? { ...row, currency } : row),
      ),
    });
    return {
      ...rework(statement),
      ...(statement.otherAccounts && { otherAccounts: statement.otherAccounts.map(rework) }),
    };
  }
}
