import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { withPaymentTypes } from '../helpers/statement-payment-type.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's name in the footer or the web address, and the account block on the first page. */
const BENDIGO_NAME = /\bBendigo and Adelaide Bank Limited\b|\bbendigobank\.com\.au\b/i;
const BENDIGO_ACCOUNT = /\bBSB number\b/i;

export function isBendigoStatement(text: string): boolean {
  return BENDIGO_NAME.test(text) && BENDIGO_ACCOUNT.test(text);
}

/** How a line starts, by payment type; only the wordings printed on a statement are listed. */
const PAYMENT_TYPES: [PaymentType, RegExp][] = [
  ['card', /^WITHDRAWAL\s*-\s*EFTPOS\b/i],
  ['interest', /^INTEREST\b/i],
];

export function bendigoPaymentType(description: string): PaymentType | null {
  const text = description.replace(/\s+/g, ' ').trim();
  return PAYMENT_TYPES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** What an EFTPOS line prints around the payee: the terminal number before it, the card after. */
const EFTPOS_PREFIX = /^WITHDRAWAL\s*-\s*EFTPOS\s+(?:\d+\s+)?/i;
const CARD_SUFFIX = /\s+CARD NUMBER\b.*$/i;

export function bendigoPayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  return EFTPOS_PREFIX.test(text) ? text.replace(EFTPOS_PREFIX, '').replace(CARD_SUFFIX, '') : '';
}

/**
 * The monthly fee block: a dated "Monthly Transaction Summary" line, then the
 * fees and the rebate against them. It is a note on fees already netted; the
 * bank's totals leave it out, and only its "Net Transaction Fees" line moves
 * the balance.
 */
const FEE_SUMMARY = /^Monthly Transaction Summary\b/i;

const hasMoney = (row: LayoutTransaction) => (row.debit ?? 0) !== 0 || (row.credit ?? 0) !== 0;

/**
 * Bendigo Bank (Australia) account statement: Withdrawals, Deposits and
 * Balance columns under a "Transaction" heading, the payee on the lines below
 * the date. The generic layout reading does the table; this names the bank,
 * leaves out the zero-value lines and the fee summary, and gives each line
 * its payee and type.
 */
export class BendigoParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.BENDIGO && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isBendigoStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    return withPaymentTypes(await super.parse(filePath, cachedText), bendigoPaymentType);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super
      .readTransactions(rows)
      .filter(row => hasMoney(row) && !FEE_SUMMARY.test(row.description))
      .map(row => ({ ...row, counterparty: row.counterparty || bendigoPayee(row.description) }));
  }
}
