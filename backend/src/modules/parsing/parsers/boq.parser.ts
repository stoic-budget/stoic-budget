import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's name over the address block, and the title every statement carries. */
const BOQ_NAME = /\bBank of Queensland Limited\b/i;
const BOQ_STATEMENT = /^\s*STATEMENT\s*$/im;

export function isBoqStatement(text: string): boolean {
  return BOQ_NAME.test(text) && BOQ_STATEMENT.test(text);
}

/**
 * Bank of Queensland (Australia) account statement: "From 02-Mar-2025 to
 * 01-Apr-2025", a Posting Date / Transaction Details / Debit / Credit /
 * Balance table with the year on a line of its own and balances suffixed
 * "cr" or "dr". The generic layout reading does all of it; this only names
 * the bank.
 */
export class BoqParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.BOQ && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isBoqStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }
}
