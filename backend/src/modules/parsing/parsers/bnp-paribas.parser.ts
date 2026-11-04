import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import { findMonthPeriod } from '../helpers/statement-header-period.helper';
import { withPaymentTypes } from '../helpers/statement-payment-type.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's name over the address block, and the statement number every page repeats. */
const BNP_NAME = /\bBNP Paribas Bank Polska\b/i;
const BNP_STATEMENT = /\bStatement number\b/i;

export function isBnpParibasStatement(text: string): boolean {
  return BNP_NAME.test(text) && BNP_STATEMENT.test(text);
}

/** How an operation type starts, by payment type; only the wordings printed on a statement are listed. */
const PAYMENT_TYPES: [PaymentType, RegExp][] = [
  ['fee', /^ACCOUNT\/PACKAGE MAINTENANCE FEE\b/i],
  ['fee', /^COMM-/i],
];

export function bnpParibasPaymentType(description: string): PaymentType | null {
  const text = description.replace(/\s+/g, ' ').trim();
  return PAYMENT_TYPES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/**
 * BNP Paribas Bank Polska account statement: a numbered list of operations
 * with the date, the beneficiary, the operation type and details, and one
 * signed amount under "Deposits (CR)" over "Withdrawals (DT)"; the balances
 * sit in a summary on the last page. The generic layout reading does the
 * table; this names the bank, reads the month the statement is for and gives
 * each operation its type.
 */
export class BnpParibasParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.BNP_PARIBAS && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isBnpParibasStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    return withPaymentTypes(await super.parse(filePath, cachedText), bnpParibasPaymentType);
  }

  protected extractDateRange(text: string): { from: Date | null; to: Date | null } {
    return findMonthPeriod(text) ?? super.extractDateRange(text);
  }
}
