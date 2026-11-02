import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/**
 * The bank's name in the statement's heading, as it prints it or misspelt as
 * a sample of it is ("COMMERCIAL BANK OF CYELON"), and the note under the
 * balance heading.
 */
const COMMERCIAL_NAME = /\bCOMMERCIAL BANK OF C(?:EYLON|YELON)\b/i;
const COMMERCIAL_NOTE = /\bWHEN OVERDRAWN\b/i;

export function isCommercialBankStatement(text: string): boolean {
  return COMMERCIAL_NAME.test(text) && COMMERCIAL_NOTE.test(text);
}

/** What an entry's first words say it is. */
const KINDS: [RegExp, PaymentType][] = [
  [/^(?:CASH|WITHDRAWA?L)\b/i, 'cash'],
  [/^PURCHASE\b/i, 'card'],
  [/^INTE?REST\b/i, 'interest'],
  [/^TO \d+$/i, 'bank_transfer_out'],
];

export function commercialEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const paymentType = KINDS.find(([pattern]) => pattern.test(text))?.[1];
  return paymentType ? { ...row, paymentType } : row;
}

/**
 * Commercial Bank of Ceylon (Sri Lanka) statement of account: one account in
 * LKR, its entries under Date, Particulars, Payments, Receipts and Balance,
 * opened and closed by a dated balance line. The generic layout reading does
 * the table; this names the bank and types the entries.
 */
export class CommercialBankParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.COMMERCIAL_BANK && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCommercialBankStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const statement = await super.parse(filePath, cachedText);
    return { ...statement, transactions: statement.transactions.map(commercialEntry) };
  }
}
