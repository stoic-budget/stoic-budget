import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { withPaymentTypes } from '../helpers/statement-payment-type.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The web address in every page footer, and the summary every statement opens with. */
const CAPITAL_ONE_SITE = /\bcapitalone\.com\b/i;
const CAPITAL_ONE_SUMMARY = /\bCashflow Summary\b/i;

export function isCapitalOneStatement(text: string): boolean {
  return CAPITAL_ONE_SITE.test(text) && CAPITAL_ONE_SUMMARY.test(text);
}

/** How a line starts, by payment type; only the wordings printed on a statement are listed. */
const PAYMENT_TYPES: [PaymentType, RegExp][] = [
  ['bank_transfer_in', /^Deposit from\b/i],
  ['bank_transfer_out', /^Withdrawal from\b/i],
  ['interest', /^Monthly Interest Paid\b/i],
];

export function capitalOnePaymentType(description: string): PaymentType | null {
  const text = description.replace(/\s+/g, ' ').trim();
  return PAYMENT_TYPES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** A transfer line names the other party after "Deposit from" or "Withdrawal from". */
const TRANSFER_PREFIX = /^(?:Deposit|Withdrawal) from\s+/i;

export function capitalOnePayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  return TRANSFER_PREFIX.test(text) ? text.replace(TRANSFER_PREFIX, '') : '';
}

/** The account's own heading: "360 Checking - 36234513058". */
const ACCOUNT_HEADING = /^\S.* - (\d{8,})\s*$/m;

/**
 * Capital One (US) bank statement: "Jul 1 - Jul 31, 2023" as the period, a
 * Date / Description / Category / Amount / Balance table with a signed amount
 * ("+ $0.05"), the year only in the period. The generic layout reading does
 * the table; this names the bank, reads the account number from the account's
 * heading and gives each line its payee and type.
 */
export class CapitalOneParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.CAPITAL_ONE && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isCapitalOneStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = withPaymentTypes(await super.parse(filePath, text), capitalOnePaymentType);
    const accountNumber = ACCOUNT_HEADING.exec(text)?.[1];
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        accountNumber: statement.metadata.accountNumber || accountNumber || '',
      },
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || capitalOnePayee(row.description),
    }));
  }
}
