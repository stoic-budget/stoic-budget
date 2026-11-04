import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's phone line in the letterhead, and the period line every statement prints. */
const BPI_NAME = /\bBPI Express Phone\b/i;
const BPI_PERIOD = /\bPERIOD COVERED\b/i;

export function isBpiStatement(text: string): boolean {
  return BPI_NAME.test(text) && BPI_PERIOD.test(text);
}

/** The account number sits on the period line: "PERIOD COVERED: … NO: 8099-260-705". */
const ACCOUNT_ON_PERIOD_LINE = /\bPERIOD COVERED:[^\n]*?\bNO:\s*(\d[\d-]*\d)/i;

/**
 * How a row's text starts, by payment type; only the wordings printed on a
 * statement are listed. The direction is not in the text, the column is.
 */
const CASH = /\b(?:ATM WDL|EPS AT EN)\b/i;
const MOBILE_PAYMENT = /\bEDL\/MB PAY\b/i;
const INTER_BANK = /\bINTER-BANK FUND TRANSFER\b/i;

export function bpiPaymentType(description: string, credit: boolean): PaymentType | null {
  if (CASH.test(description)) {
    return 'cash';
  }
  if (MOBILE_PAYMENT.test(description)) {
    return 'bank_transfer_out';
  }
  if (INTER_BANK.test(description)) {
    return credit ? 'bank_transfer_in' : 'bank_transfer_out';
  }
  return null;
}

/** "TO: GCASH CASH IN …..XXXXX99827": the payee, without the masked number after it. */
const PAYEE = /\bTO:\s*(.+?)\s*(?:[….]+\s*)?X{2,}\d*$/i;

export function bpiPayee(description: string): string {
  return PAYEE.exec(description.replace(/\s+/g, ' ').trim())?.[1].trim() ?? '';
}

/**
 * Bank of the Philippine Islands (BPI) account statement: Date, Description,
 * Ref, Details, Deb Amt, Credit Amt and Balance, the date as month and day,
 * the year only in the period line. The generic layout reading does the
 * table; this names the bank, reads the account number from the period line
 * and gives each row its payee and type.
 */
export class BpiParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.BPI && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isBpiStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const accountNumber = ACCOUNT_ON_PERIOD_LINE.exec(text)?.[1];
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        accountNumber: statement.metadata.accountNumber || accountNumber || '',
      },
      transactions: statement.transactions.map(row => {
        const paymentType = bpiPaymentType(row.paymentPurpose, Number(row.credit) > 0);
        return paymentType ? { ...row, paymentType } : row;
      }),
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || bpiPayee(row.description),
    }));
  }
}
