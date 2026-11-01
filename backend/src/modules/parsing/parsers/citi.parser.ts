import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The title every page carries, and the heading of the table. */
const CITI_TITLE = /\bYour Citibank Account Statement\b/;
const CITI_TABLE = /\bTransaction Details\b/;

export function isCitiStatement(text: string): boolean {
  return CITI_TITLE.test(text) && CITI_TABLE.test(text);
}

/**
 * The other side of an IMPS, UPI or NEFT entry, from the words the bank
 * prints under the entry's type: a UPI handle, a bank account's name or the
 * sender of a transfer.
 */
const PAYEES = [
  /\bUPI (?:To|From)\s+([^,\s]+)/i,
  /\bIMPS TO \d+ - (.+?)\s+REF\s*NO/i,
  /\bIMPSTO from (.+?)\s+REF\s*NO/i,
  /\bNEFT IN UTR \S+ FROM (.+?)(?=\s+\d{5,}|$)/i,
];

export function citiPayee(description: string): string {
  const text = description.replace(/\s+/g, ' ').trim();
  for (const pattern of PAYEES) {
    const match = pattern.exec(text);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

/** IMPS, NEFT and UPI entries are transfers; the column says which way. */
const TRANSFER = /^(?:IMPS|NEFT|UPI|RTGS)\b/i;

/** The account, masked, in the nominee list: "1. 50XX8XXX27 NOMINEE NOT REGISTERED". */
const NOMINEE_ACCOUNT = /Nominee Details[^\n]*\n\s*\d+\.\s+(\S+)\s+NOMINEE/i;

export function citiPaymentType(description: string, credit: boolean): PaymentType | null {
  if (!TRANSFER.test(description.trim())) {
    return null;
  }
  return credit ? 'bank_transfer_in' : 'bank_transfer_out';
}

/**
 * Citibank (India) account statement: Date as "02Jul24", Transaction Details
 * over several lines, Withdrawals, Deposits and a Balance printed only where
 * it changes. The generic layout reading does the table; this names the bank
 * and gives each entry its payee and type.
 */
export class CitiParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.CITI && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isCitiStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    return {
      ...statement,
      metadata: {
        ...statement.metadata,
        accountNumber: statement.metadata.accountNumber || NOMINEE_ACCOUNT.exec(text)?.[1] || '',
      },
      transactions: statement.transactions.map(row => {
        const paymentType = citiPaymentType(row.paymentPurpose, Number(row.credit) > 0);
        return paymentType ? { ...row, paymentType } : row;
      }),
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || citiPayee(row.description),
    }));
  }
}
